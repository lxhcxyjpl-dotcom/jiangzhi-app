# 把 timetable-data.json 注入模板 -> app/timetable.html（单文件，双击即用）
import json, pathlib, sys

root = pathlib.Path(__file__).resolve().parent.parent
tpl = (root / "app" / "timetable.tpl.html").read_text(encoding="utf-8")
data = json.loads((root / "assets" / "timetable-data.json").read_text(encoding="utf-8"))
js = "const TIMETABLE_DATA = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";"
assert "/*__TIMETABLE_DATA__*/" in tpl, "placeholder not found"
out = tpl.replace("/*__TIMETABLE_DATA__*/", js)
dst = root / "app" / "timetable.html"
dst.write_text(out, encoding="utf-8")
print("OK ->", dst, f"{dst.stat().st_size/1024:.1f} KB")
