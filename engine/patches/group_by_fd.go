// Copied into go-mysql-server's sql/analyzer package by engine/build.sh (patch 7).
// MySQL 8 knows functional dependencies: grouping by a table's whole primary key allows selecting that table's other
// columns (SELECT Pnumber, Pname ... GROUP BY Pnumber). validateGroupBy calls these two helpers.

package analyzer

import (
	"strings"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/transform"
)

// groupedKeyTables returns the tables (lower-case, as columns name them) whose whole primary key is grouped on.
func groupedKeyTables(gb *plan.GroupBy, groupBys []string) map[string]bool {
	grouped := lowerSet(groupBys)
	out := map[string]bool{}
	transform.Inspect(gb.Child, func(n sql.Node) bool {
		var name string
		var node sql.Node = n
		switch t := n.(type) {
		case *plan.TableAlias:
			name, node = t.Name(), t.Child
		case *plan.ResolvedTable:
			name = t.Name()
		case *plan.IndexedTableAccess:
			name = t.Name()
		default:
			return true
		}
		// the full schema of the stored table: the node's own schema may hold only the columns the query uses
		sch := node.Schema()
		if tn, ok := node.(sql.TableNode); ok {
			if pkt, ok := tn.UnderlyingTable().(sql.PrimaryKeyTable); ok {
				sch = pkt.PrimaryKeySchema().Schema
			}
		}
		pk, all := 0, true
		for _, c := range sch {
			if c.PrimaryKey {
				pk++
				if !grouped[strings.ToLower(name+"."+c.Name)] {
					all = false
				}
			}
		}
		if pk > 0 && all {
			out[strings.ToLower(name)] = true
		}
		_, isAlias := n.(*plan.TableAlias)
		return !isAlias // the table under an alias is known by the alias
	})
	return out
}

// onlyDeterminedColumns: every column the expression uses outside aggregates is grouped on, or belongs to a table
// whose primary key is grouped on.
func onlyDeterminedColumns(expr sql.Expression, groupBys []string, determined map[string]bool) bool {
	grouped := lowerSet(groupBys)
	ok := true
	sql.Inspect(expr, func(e sql.Expression) bool {
		switch e := e.(type) {
		case sql.Aggregation:
			return false
		case *expression.GetField:
			if !grouped[strings.ToLower(e.String())] && !determined[strings.ToLower(e.Table())] {
				ok = false
			}
			return false
		}
		return true
	})
	return ok
}

func lowerSet(xs []string) map[string]bool {
	m := make(map[string]bool, len(xs))
	for _, x := range xs {
		m[strings.ToLower(x)] = true
	}
	return m
}
