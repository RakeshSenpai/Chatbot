<script>
  // We use Pollinations.ai free API — no key required
  const BASE = 'https://image.pollinations.ai/prompt/';

  const SEEDS = [42, 137, 256, 512, 1024, 777, 99, 333];

  async function generate() {
    const prompt = document.getElementById('prompt').value.trim();
    if (!prompt) {
      showError('Please enter a prompt first.');
      return;
    }
    hideError();

    const count = parseInt(document.getElementById('countSelect').value);
    const ratio = document.getElementById('ratioSelect').value;
    const btn = document.getElementById('generateBtn');

    btn.disabled = true;
    btn.textContent = '⏳ Generating...';

    // Determine dimensions
    let w = 512, h = 512;
    if (ratio === '16:9') { w = 768; h = 432; }
    else if (ratio === '9:16') { w = 432; h = 768; }
    else if (ratio === '4:3') { w = 640; h = 480; }

    // Show loading cards
    document.getElementById('emptyGrid').style.display = 'none';
    const grid = document.getElementById('imageGrid');
    grid.style.display = 'grid';
    grid.innerHTML = '';

    const cards = [];
    for (let i = 0; i < count; i++) {
      const card = document.createElement('div');
      card.className = 'image-card loading';
      card.innerHTML = `<div class="spinner"></div><span>Generating...</span>`;
      grid.appendChild(card);
      cards.push(card);
    }

    // Generate images in parallel
    const promises = cards.map((card, i) => {
      const seed = SEEDS[i % SEEDS.length] + Math.floor(Math.random() * 100);
      const url = `${BASE}${encodeURIComponent(prompt)}?width=${w}&height=${h}&seed=${seed}&nologo=true`;
      return loadImage(url, card, i);
    });

    await Promise.allSettled(promises);

    btn.disabled = false;
    btn.innerHTML = '✦ Generate';
  }

  function loadImage(url, card, idx) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        card.className = 'image-card';
        card.innerHTML = '';
        card.appendChild(img);

        // Download overlay
        const overlay = document.createElement('div');
        overlay.className = 'overlay';
        const dlBtn = document.createElement('button');
        dlBtn.className = 'overlay-btn';
        dlBtn.textContent = '⬇ Download';
        dlBtn.onclick = (e) => {
          e.stopPropagation();
          downloadImage(url, `generated-${idx+1}.jpg`);
        };
        overlay.appendChild(dlBtn);
        card.appendChild(overlay);
        resolve();
      };
      img.onerror = () => {
        card.className = 'image-card loading';
        card.innerHTML = `<div style="color:#e66;font-size:13px;text-align:center;padding:10px;">⚠ Failed<br><small>Try again</small></div>`;
        resolve();
      };
      img.src = url;
      img.alt = 'Generated image';
    });
  }

  function downloadImage(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    a.click();
  }

  function showError(msg) {
    const el = document.getElementById('errorMsg');
    el.textContent = msg;
    el.classList.add('show');
  }
  function hideError() {
    document.getElementById('errorMsg').classList.remove('show');
  }

  // Enter key support
  document.getElementById('prompt').addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) generate();
  });
</script>