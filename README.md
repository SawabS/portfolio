# Portfolio — Sawab Sarkavri

A personal site built like an interactive course. Plain HTML, CSS and JavaScript, with no build step and no dependencies.

## Preview

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

## Publish on GitHub Pages

Push to `main`, then choose **Settings → Pages → Deploy from a branch → main / root**. The site appears at `https://sawabs.github.io/portfolio/`. If it ends up at another address, update the `og:image` URL in `index.html`.

## Where things live

| Path | What it is |
|---|---|
| `index.html` | All page content: edit copy, projects and career steps here |
| `assets/js/tokenizer.js` | The BPE tokenizer and token tiles; sample sentences are in `SAMPLES` |
| `assets/js/floor.js` | The hero floor of rising letter tiles |
| `assets/js/scenes.js` | The animated miniatures on the project cards |
| `assets/js/site.js` | Scroll effects, career path, stack, quiz and XP |
| `assets/css/site.css` | Site styles on top of the design kit |
| `assets/kit/` | The design kit: tokens, components and bundled fonts |
| `assets/cv/` | The CV linked from the contact section |

Resume PDFs in the repository root are ignored by git on purpose. Only `assets/cv/` is published.
