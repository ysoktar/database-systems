//go:build js && wasm

// The site's database: go-mysql-server (a MySQL-compatible SQL engine, in memory) compiled to WebAssembly.
//
// JavaScript API (set on globalThis once the module runs):
//   gmsQuery(sql)  → JSON string of one statement's result:
//                    {"isResult": true, "columns": [...], "types": [...], "rows": [[...]]}
//                    {"isResult": false, "affected": n}
//                    {"error": {"code": 1062, "state": "23000", "message": "..."}}
//   gmsReset()     → a fresh, empty server (databases are created again by the caller)
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"syscall/js"
	"time"

	sqle "github.com/dolthub/go-mysql-server"
	"github.com/dolthub/go-mysql-server/memory"
	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/types"
	"github.com/shopspring/decimal"
	"github.com/sirupsen/logrus"
)

var (
	engine *sqle.Engine
	ctx    *sql.Context
)

func newEngine() {
	db := memory.NewDatabase("company")
	db.BaseDatabase.EnablePrimaryKeyIndexes()
	pro := memory.NewDBProvider(db)
	pro.WithOption(memory.NativeIndexProvider(true)) // databases made by CREATE DATABASE index their primary keys too
	engine = sqle.NewDefault(pro)
	session := memory.NewSession(sql.NewBaseSession(), pro)
	ctx = sql.NewContext(context.Background(), sql.WithSession(session))
	ctx.SetCurrentDatabase("company")
}

type errOut struct {
	Code    int    `json:"code"`
	State   string `json:"state"`
	Message string `json:"message"`
}

type result struct {
	IsResult bool            `json:"isResult"`
	Columns  []string        `json:"columns,omitempty"`
	Types    []string        `json:"types,omitempty"`
	Rows     [][]interface{} `json:"rows"`
	Affected int64           `json:"affected"`
	Error    *errOut         `json:"error,omitempty"`
}

// MySQL's error numbers for the errors the engine reports generically (1105 = ER_UNKNOWN_ERROR).
var errorCodes = []struct {
	re    *regexp.Regexp
	code  int
	state string
}{
	{regexp.MustCompile(`(?i)duplicate (primary key|unique key|entry)`), 1062, "23000"},
	{regexp.MustCompile(`(?i)cannot add or update a child row`), 1452, "23000"},
	{regexp.MustCompile(`(?i)cannot delete or update a parent row`), 1451, "23000"},
	{regexp.MustCompile(`(?i)non-nullable|cannot be null`), 1048, "23000"},
	{regexp.MustCompile(`(?i)doesn't have a default value`), 1364, "HY000"},
	{regexp.MustCompile(`(?i)check constraint .* (is )?violated`), 3819, "HY000"},
	{regexp.MustCompile(`(?i)out of range`), 1264, "22003"},
	{regexp.MustCompile(`(?i)table not found|doesn't exist`), 1146, "42S02"},
	{regexp.MustCompile(`(?i)already exists`), 1050, "42S01"},
	{regexp.MustCompile(`(?i)column .* could not be found|unknown column`), 1054, "42S22"},
	{regexp.MustCompile(`(?i)syntax error`), 1064, "42000"},
	{regexp.MustCompile(`(?i)doesn't appear in the group by expressions`), 1055, "42000"},
	{regexp.MustCompile(`(?i)CHECK OPTION failed`), 1369, "HY000"},
	{regexp.MustCompile(`(?i)cannot drop table .* referenced in foreign key`), 3730, "HY000"},
	{regexp.MustCompile(`(?i)references invalid table`), 1356, "HY000"},
}

var groupByMsg = regexp.MustCompile(`expression '(.*)' doesn't appear in the group by expressions`)

func toError(err error) *errOut {
	e := sql.CastSQLError(err)
	out := &errOut{Code: int(e.Num), State: e.State, Message: e.Message}
	if out.Code == 1105 || out.State == "HY000" {
		for _, c := range errorCodes {
			if c.re.MatchString(out.Message) {
				if out.Code == 1105 {
					out.Code = c.code
				}
				out.State = c.state
				break
			}
		}
	}
	if out.State == "" {
		out.State = "HY000"
	}
	// MySQL's own wording for the ONLY_FULL_GROUP_BY error
	if m := groupByMsg.FindStringSubmatch(out.Message); m != nil {
		out.Message = "Expression is not in GROUP BY clause and contains nonaggregated column '" + m[1] +
			"' which is not functionally dependent on columns in GROUP BY clause; this is incompatible with sql_mode=only_full_group_by"
	}
	return out
}

// value turns a Go value of column type t into what JSON should carry (MySQL's text form for decimals and dates).
func value(t sql.Type, v interface{}) interface{} {
	if v == nil {
		return nil
	}
	if conv, _, err := t.Convert(ctx, v); err == nil && conv != nil {
		v = conv
	}
	if dt, ok := t.(sql.DecimalType); ok {
		var d decimal.Decimal
		switch x := v.(type) {
		case decimal.Decimal:
			d = x
		case decimal.NullDecimal:
			if !x.Valid {
				return nil
			}
			d = x.Decimal
		default:
			return fmt.Sprint(v)
		}
		return d.StringFixed(int32(dt.Scale()))
	}
	switch x := v.(type) {
	case time.Time:
		name := strings.ToLower(t.String())
		switch {
		case name == "date":
			return x.Format("2006-01-02")
		case strings.HasPrefix(name, "time") && !strings.HasPrefix(name, "timestamp"):
			return x.Format("15:04:05")
		default:
			return x.Format("2006-01-02 15:04:05")
		}
	case decimal.Decimal:
		return x.String()
	case []byte:
		return string(x)
	case bool, string, float32, float64, int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
		return x
	default:
		return fmt.Sprint(x)
	}
}

func run(query string) (res result) {
	defer func() {
		if r := recover(); r != nil {
			res = result{Rows: [][]interface{}{}, Error: &errOut{Code: 1105, State: "HY000", Message: fmt.Sprint(r)}}
		}
	}()
	res.Rows = [][]interface{}{}
	schema, iter, _, err := engine.Query(ctx, query)
	if err != nil {
		return result{Rows: res.Rows, Error: toError(err)}
	}
	rows, err := sql.RowIterToRows(ctx, iter)
	if err != nil {
		return result{Rows: res.Rows, Error: toError(err)}
	}
	if types.IsOkResultSchema(schema) {
		if len(rows) == 1 {
			if ok, isOk := rows[0][0].(types.OkResult); isOk {
				return result{Rows: res.Rows, Affected: int64(ok.RowsAffected)}
			}
		}
		return result{Rows: res.Rows}
	}
	if len(schema) == 0 {
		return result{Rows: res.Rows} // SET, USE, BEGIN, COMMIT, ...
	}
	res.IsResult = true
	for _, c := range schema {
		res.Columns = append(res.Columns, c.Name)
		res.Types = append(res.Types, c.Type.String())
	}
	for _, r := range rows {
		out := make([]interface{}, len(schema))
		for i := range schema {
			if i < len(r) {
				out[i] = value(schema[i].Type, r[i])
			}
		}
		res.Rows = append(res.Rows, out)
	}
	return res
}

func main() {
	logrus.SetLevel(logrus.PanicLevel) // the engine logs internal warnings; keep the browser console clean
	newEngine()
	js.Global().Set("gmsQuery", js.FuncOf(func(this js.Value, args []js.Value) interface{} {
		b, _ := json.Marshal(run(args[0].String()))
		return string(b)
	}))
	js.Global().Set("gmsReset", js.FuncOf(func(this js.Value, args []js.Value) interface{} {
		newEngine()
		return nil
	}))
	js.Global().Set("gmsReady", true)
	select {}
}
