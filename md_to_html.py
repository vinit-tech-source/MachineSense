import markdown
import os

html_template = '''
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{title}</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px;
            background: #fff;
        }}
        h1, h2, h3, h4 {{
            color: #111;
            border-bottom: 1px solid #eaecef;
            padding-bottom: .3em;
        }}
        h1 {{ font-size: 2em; }}
        h2 {{ font-size: 1.5em; }}
        code {{
            background-color: rgba(27,31,35,.05);
            border-radius: 3px;
            font-size: 85%;
            margin: 0;
            padding: .2em .4em;
            font-family: SFMono-Regular,Consolas,Liberation Mono,Menlo,monospace;
        }}
        pre {{
            background-color: #f6f8fa;
            border-radius: 3px;
            font-size: 85%;
            line-height: 1.45;
            overflow: auto;
            padding: 16px;
        }}
        pre code {{
            background-color: transparent;
            padding: 0;
        }}
        table {{
            border-collapse: collapse;
            width: 100%;
            margin-bottom: 20px;
        }}
        th, td {{
            border: 1px solid #dfe2e5;
            padding: 6px 13px;
        }}
        th {{ background-color: #f6f8fa; }}
        blockquote {{
            border-left: .25em solid #dfe2e5;
            color: #6a737d;
            padding: 0 1em;
            margin: 0;
        }}
    </style>
</head>
<body>
    {content}
</body>
</html>
'''

files = ['YieldWatt_Sprint_Build_Document', 'YieldWatt_Full_Project_Details']
desktop = os.path.join(os.path.expanduser('~'), 'Desktop')

for f in files:
    md_path = os.path.join(desktop, f + '.md')
    html_path = os.path.join(desktop, f + '.html')
    
    with open(md_path, 'r', encoding='utf-8') as file:
        text = file.read()
        
    html_content = markdown.markdown(text, extensions=['tables', 'fenced_code'])
    final_html = html_template.format(title=f.replace('_', ' '), content=html_content)
    
    with open(html_path, 'w', encoding='utf-8') as file:
        file.write(final_html)
