import sys
from pathlib import Path
from playwright.sync_api import sync_playwright
aqui=Path(__file__).parent
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1920,"height":1080})
    pg.goto((aqui/"playbook.html").as_uri()); pg.wait_for_timeout(500)
    # detectar desbordes: contenido que se sale de su diapositiva
    print(pg.evaluate("""() => [...document.querySelectorAll('.slide')].map((s,i)=>{const r=s.getBoundingClientRect(); let m=0; s.querySelectorAll('*').forEach(e=>{const q=e.getBoundingClientRect(); if(!e.classList.contains('glow') && !e.classList.contains('fig')) m=Math.max(m,q.bottom-r.top)}); return [i+1, Math.round(m)]})"""))
    pg.pdf(path=sys.argv[1], width="1920px", height="1080px", print_background=True)
    b.close()
