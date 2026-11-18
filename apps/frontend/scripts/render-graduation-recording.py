"""Encode actual CDP screen frames; no video codec or new app dependency required."""
import json
import sys
from pathlib import Path
from PIL import Image

folder = Path(sys.argv[1]).resolve()
frames = json.loads((folder / "screen-frames" / "frames.json").read_text())
assert frames, "No captured browser frames"
images = [Image.open(folder / "screen-frames" / frame["file"]).convert("RGB") for frame in frames]
durations = [max(120, min(2000, frames[index + 1]["time"] - frame["time"]))
             if index + 1 < len(frames) else 1500 for index, frame in enumerate(frames)]
target = folder / "patient-interactions.gif"
images[0].save(target, save_all=True, append_images=images[1:], duration=durations,
               loop=0, optimize=True, disposal=2)
report_file = folder / "report.json"
report = json.loads(report_file.read_text())
report["recording"] = {"file": target.name, "frames": len(frames),
                       "durationSeconds": sum(durations) / 1000,
                       "mode": "Actual browser screen recording; idle pauses capped at two seconds. Synthetic accounts only."}
report_file.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"recording": target.name, "frames": len(frames), "seconds": sum(durations) / 1000}))
