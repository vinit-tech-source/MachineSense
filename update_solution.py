from pptx import Presentation
from pptx.util import Pt
import sys

def replace_text(shape, old_text, new_text):
    if not hasattr(shape, "text_frame") or shape.text_frame is None:
        return
    for paragraph in shape.text_frame.paragraphs:
        for run in paragraph.runs:
            if old_text in run.text:
                run.text = run.text.replace(old_text, new_text)
    
    # Fallback
    if old_text in shape.text:
        shape.text = shape.text.replace(old_text, new_text)

def update_solution_slide(file_path, out_path):
    prs = Presentation(file_path)
    slide = prs.slides[3] # Slide 4

    # 1. Main statement (Shape 5)
    replace_text(slide.shapes[5], 
        "A low-cost sensor node plus an explainable AI engine that tells a factory owner exactly what's wrong, what it's costing, and what to do next.",
        "An adaptive machine-monitoring and AI system that turns available factory data into contextual insights, anomaly detection, and actionable recommendations."
    )

    # 2. Key differentiator (Shape 12)
    replace_text(slide.shapes[12],
        "Every alert explains itself (which signal, how much) instead of an unexplained warning light — and the system is allowed to act on its own only for safe, reversible actions like switching on a cooling fan.",
        "Machine-specific contextual intelligence. The system does not rely on fixed universal thresholds. It learns each machine's normal behaviour and combines baseline analysis, SEC, anomaly scores, and supporting signals before generating a recommendation."
    )

    # 3. Columns headings (Shapes 16, 21, 26, 31)
    replace_text(slide.shapes[16], "Sense", "01 — CONNECT\nCollect machine data\n• Voltage, current, power, energy\n• Production / part count\n• Reject count\n• Temperature, vibration\n• Optional RPM and pressure")
    replace_text(slide.shapes[21], "Understand", "02 — UNDERSTAND\nLearn machine behaviour\n• Learn normal behaviour for each machine\n• Identify operating state\n• Establish machine-specific baseline\n• Calculate energy per good unit (SEC)")
    replace_text(slide.shapes[26], "Explain", "03 — DETECT\nIdentify meaningful anomalies\n• ML-based anomaly detection\n• Compare live data with baseline\n• Correlate multiple signals\n• Consider production and operating conditions\n• Reduce false alarms")
    replace_text(slide.shapes[31], "Act", "04 — ACT\nTurn insights into action\n• Identify likely cause\n• Show confidence and severity\n• Provide supporting evidence\n• Recommend safe operator action\n• Estimate energy and cost impact")

    # 4. Remove old "How it solves the problem" and its bullets if they are no longer needed
    # Wait, the user said "Keep exact layout... only replace content".
    # But the user provided 4 columns to replace "Sense, Understand, Explain, Act" and didn't mention "How it solves the problem".
    # Wait! Maybe Shape 6 and Shape 7 were already deleted by the user in their latest version, OR maybe they want me to delete them.
    # Let me just clear them to be safe if they didn't provide text for them, but wait, the user said "Only replace the existing content/data and ideas".
    # So I will clear Shape 6 and 7 if the new text fits in the 4 columns.
    
    # Wait, there's "Bottom statement: Measure -> Understand -> Detect -> Explain -> Act".
    # Where does that go? Maybe in Shape 6? Or Shape 7?
    replace_text(slide.shapes[6], "How it solves the problem", "Bottom statement")
    replace_text(slide.shapes[7], "Retrofits any existing machine — no replacement, no PLC needed.\nCosts under ₹2,500 per machine, versus ₹15,000–25,000+ commercially.\nNow integrated with Schneider Electric PowerLogic™ meters for enterprise-grade reliability.\nNow integrated with Schneider Electric PowerLogic™ meters for enterprise-grade reliability.\nCatches mechanical wear and energy waste before the monthly bill or a breakdown reveals it.", "Measure → Understand → Detect → Explain → Act")
    
    prs.save(out_path)

if __name__ == "__main__":
    update_solution_slide(sys.argv[1], sys.argv[2])
