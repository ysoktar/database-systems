#!/bin/sh
# Build the site's MySQL-compatible database (go-mysql-server) to WebAssembly.
#   engine/dist/mysql.wasm    the engine
#   engine/dist/wasm_exec.js  Go's JavaScript glue for it
# Needs Go 1.24+. Dependencies are vendored and patched:
#   1. vitess refers to syscall.SIGHUP, which does not exist under GOOS=js
#   2. ONLY_FULL_GROUP_BY was skipped whenever a GROUP BY sits under a projection (a TODO in the engine), so
#      "SELECT Dno, Lname, COUNT(*) ... GROUP BY Dno" was accepted; MySQL 8 rejects it (error 1055).
#      (Unlike MySQL 8 it does not know functional dependencies: GROUP BY Pnumber does not allow selecting Pname.)
set -eu
cd "$(dirname "$0")"
go mod download
rm -rf vendor
go mod vendor
chmod -R u+w vendor

sed -i 's/syscall\.SIGHUP/syscall.Signal(1)/g' vendor/github.com/dolthub/vitess/go/mysql/auth_server_static.go

rules=vendor/github.com/dolthub/go-mysql-server/sql/analyzer/validation_rules.go
python3 - "$rules" <<'EOF'
import sys
p = sys.argv[1]
s = open(p).read()
old = """		switch parent.(type) {
		case *plan.Having, *plan.Project, *plan.Sort:
			// TODO: these shouldn't be skipped; you can group by primary key without problem b/c only one value
			// https://dev.mysql.com/doc/refman/8.0/en/group-by-handling.html#:~:text=The%20query%20is%20valid%20if%20name%20is%20a%20primary%20key
			return true
		}
"""
assert old in s, "group-by patch no longer applies"
s = s.replace(old, "		_ = parent\n")
# the planner adds the bare argument columns of aggregates used by HAVING/ORDER BY (w.Hours for HAVING SUM(w.Hours))
# to the GROUP BY's select list; they are not columns the user selected, so do not report them
old = """		for _, expr := range gb.SelectedExprs {
			if _, ok := expr.(sql.Aggregation); !ok {
"""
assert old in s, "group-by patch 2 no longer applies"
s = s.replace(old, """		aggArgs := map[string]bool{}
		transform.InspectExpressions(root, func(e sql.Expression) bool {
			if _, ok := e.(sql.Aggregation); ok {
				sql.Inspect(e, func(c sql.Expression) bool {
					if gf, ok := c.(*expression.GetField); ok {
						aggArgs[strings.ToLower(gf.String())] = true
					}
					return true
				})
			}
			return true
		})
		for _, expr := range gb.SelectedExprs {
			if gf, ok := expr.(*expression.GetField); ok && aggArgs[strings.ToLower(gf.String())] {
				continue
			}
			if _, ok := expr.(sql.Aggregation); !ok {
""")
old = """	var err error
	var parent sql.Node
	transform.Inspect(n, func(n sql.Node) bool {"""
assert old in s, "group-by patch 3 no longer applies"
s = s.replace(old, """	var err error
	var parent sql.Node
	root := n
	transform.Inspect(n, func(n sql.Node) bool {""")
open(p, "w").write(s)
EOF

# 3. [NOT] EXISTS over a correlated UNION/EXCEPT/INTERSECT was turned into a join that lost the correlation
#    ("unable to find field with index 4 in row of 2 columns"); keep such subqueries as they are
exists=vendor/github.com/dolthub/go-mysql-server/sql/analyzer/unnest_exists_subqueries.go
python3 - "$exists" <<'EOF'
import sys
p = sys.argv[1]
s = open(p).read()
old = """		// try to decorrelate
		s, err = decorrelateOuterCols(sq.Query, aliasDisambig, sq.Correlated())"""
assert old in s, "exists patch no longer applies"
s = s.replace(old, """		if !sq.Correlated().Empty() {
			hasSetOp := false
			transform.Inspect(sq.Query, func(n sql.Node) bool {
				if _, ok := n.(*plan.SetOp); ok {
					hasSetOp = true
				}
				return !hasSetOp
			})
			if hasSetOp {
				retFilters = append(retFilters, f)
				continue
			}
		}

""" + old)
open(p, "w").write(s)
EOF

# 4. MySQL 8's default collation is utf8mb4_0900_ai_ci: 'smith' = 'Smith' and LIKE ignore case. The engine's default
#    was the binary collation, which compares case-sensitively.
sed -i 's/Collation_Default                    = Collation_utf8mb4_0900_bin/Collation_Default                    = Collation_utf8mb4_0900_ai_ci/' \
  vendor/github.com/dolthub/go-mysql-server/sql/collations.go
grep -q 'Collation_Default                    = Collation_utf8mb4_0900_ai_ci' vendor/github.com/dolthub/go-mysql-server/sql/collations.go

# 5. A DATE turned into text (CAST(Bdate AS CHAR), LIKE, CONCAT) is 'YYYY-MM-DD' in MySQL, not 'YYYY-MM-DD 00:00:00'
strs=vendor/github.com/dolthub/go-mysql-server/sql/types/strings.go
python3 - "$strs" <<'EOF'
import sys
p = sys.argv[1]
s = open(p).read()
old = """	case time.Time:
		val = s.AppendFormat(dest, sql.TimestampDatetimeLayout)"""
assert old in s, "date-to-text patch no longer applies"
s = s.replace(old, """	case time.Time:
		if s.Hour() == 0 && s.Minute() == 0 && s.Second() == 0 && s.Nanosecond() == 0 {
			val = s.AppendFormat(dest, "2006-01-02")
		} else {
			val = s.AppendFormat(dest, sql.TimestampDatetimeLayout)
		}""", 1)
open(p, "w").write(s)
EOF

# 6. x NOT IN (subquery) was rewritten into an anti join, which ignores SQL's NULL rule: when the subquery returns a
#    NULL, NOT IN is never TRUE. Keep NOT IN (and NOT x = (subquery)) as a filter, evaluated with the NULL rule.
insq=vendor/github.com/dolthub/go-mysql-server/sql/analyzer/unnest_insubqueries.go
python3 - "$insq" <<'EOF'
import sys
p = sys.argv[1]
s = open(p).read()
old = """				if n, ok := e.(*expression.Not); ok {
					candE = n.Child
					op = plan.JoinTypeAnti
				}
"""
assert old in s, "NOT IN patch no longer applies"
s = s.replace(old, """				if _, ok := e.(*expression.Not); ok {
					newFilters = append(newFilters, e)
					continue
				}
""", 1)
open(p, "w").write(s)
EOF

mkdir -p dist
GOOS=js GOARCH=wasm go build -mod=vendor -trimpath -ldflags="-s -w" -o dist/mysql.wasm .
cp "$(go env GOROOT)/lib/wasm/wasm_exec.js" dist/wasm_exec.js 2>/dev/null || cp "$(go env GOROOT)/misc/wasm/wasm_exec.js" dist/wasm_exec.js
ls -l dist
