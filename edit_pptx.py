from pptx import Presentation
from pptx.util import Pt
import sys

def replace_text(shape, old_text, new_text, make_big=False):
    if not hasattr(shape, "text_frame") or shape.text_frame is None:
        return
    for paragraph in shape.text_frame.paragraphs:
        for run in paragraph.runs:
            if old_text in run.text:
                run.text = run.text.replace(old_text, new_text)
                if make_big:
                    run.font.size = Pt(24)
                    run.font.bold = True
                    
    if old_text in shape.text:
        # Fallback if runs were split
        shape.text = shape.text.replace(old_text, new_text)
        if make_big:
            for paragraph in shape.text_frame.paragraphs:
                for run in paragraph.runs:
                    run.font.size = Pt(24)
                    run.font.bold = True

def update_slides(file_path, out_path):
    prs = Presentation(file_path)
    
    # Slide 1: Title Slide (Team Members)
    slide1 = prs.slides[0]
    team_text = (
        "Team MachineSense\n\n"
        "Vinit Shinde (Team Lead)\n"
        "Harsh Vyavahare\n"
        "Dipak Mane\n"
        "Shivam Sapkal\n\n"
        "Yuva Yodha Energy Tech Hackathon 2026"
    )
    for shape in slide1.shapes:
        replace_text(shape, 
            "Team MachineSense  ·  Yuva Yodha Energy Tech Hackathon 2026", 
            team_text,
            make_big=True
        )
        # Also try just appending to Team MachineSense if the bullet wasn't caught
        replace_text(shape, 
            "Team MachineSense\n01 / 12", 
            team_text + "\n01 / 12",
            make_big=True
        )
    
    # Slide 4: Our Solution
    slide4 = prs.slides[3]
    for shape in slide4.shapes:
        replace_text(shape, 
            "Costs under ₹2,500 per machine, versus ₹15,000–25,000+ commercially.", 
            "Costs under ₹2,500 per machine, versus ₹15,000–25,000+ commercially.\nNow integrated with Schneider Electric PowerLogic™ meters for enterprise-grade reliability."
        )

    # Slide 5: How it Works
    slide5 = prs.slides[4]
    for shape in slide5.shapes:
        replace_text(shape, "Sensor node (ESP32)", "Sensor node (ESP32 & Schneider Harmony Hub)")

    # Slide 6: Architecture
    slide6 = prs.slides[5]
    for shape in slide6.shapes:
        replace_text(shape, "Sensors + ESP32 node", "ESP32 Sensors + Schneider PM5000 Modbus Meters")
        replace_text(shape, "FastAPI backend (HTTP + MQTT ingestion)", "FastAPI backend (HTTP, MQTT + Modbus TCP ingestion)")

    # Slide 10: Feasibility
    slide10 = prs.slides[9]
    for shape in slide10.shapes:
        replace_text(shape, "MachineSense sensor node", "MachineSense Hybrid Node (ESP32 + Schneider)")

    prs.save(out_path)
    print("Successfully updated PPTX and saved to", out_path)

if __name__ == "__main__":
    if len(sys.argv) > 2:
        update_slides(sys.argv[1], sys.argv[2])
    else:
        print("Usage: python edit_pptx.py input.pptx output.pptx")
