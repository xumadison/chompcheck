var scannerActive = false;
var codeReader = null; 
var lastScanned = '';
var currentScanData = null;

function showPage(p) {
      document.querySelectorAll('.page').forEach(function(el) {
        el.classList.remove('active');
      });
      document.querySelectorAll('.nav-tab').forEach(function(el) {
        el.classList.remove('active');
      });
      document.getElementById('page-' + p).classList.add('active');
      var tabs = document.querySelectorAll('.nav-tab');
      var pages = ['scan', 'tracker', 'goals'];
      tabs[pages.indexOf(p)].classList.add('active');
    }


function setStatus(msg, type) {
  var bar = document.getElementById('status-bar');
  bar.textContent = msg;
  bar.className = 'status-bar' + (type ? ' ' + type : '');
}

async function startScanner() {
  if (scannerActive) return;
  try {
    document.getElementById('cam-placeholder').style.display = 'none';
    setStatus('Starting camera...', 'loading');

    codeReader = new ZXing.BrowserMultiFormatReader();
    var devices = await codeReader.listVideoInputDevices();

    if (devices.length === 0) {
      setStatus('No camera found.', 'error');
      return;
    }

    var deviceId = devices.length > 1 ? devices[1].deviceId : devices[0].deviceId;

    await codeReader.decodeFromVideoDevice(deviceId, 'video-el', function(result, err) {
      if (result) {
        var code = result.getText();
        if (code !== lastScanned) {
          lastScanned = code;
          lookupBarcode(code);
        }
      }
    });

    scannerActive = true;
    document.getElementById('scan-region').style.display = 'block';
    document.getElementById('start-btn').style.display = 'none';
    document.getElementById('stop-btn').style.display = 'block';
    setStatus('Scanning — point at a barcode', 'scanning');

  } catch(e) {
    setStatus('Camera access denied or unavailable.', 'error');
  }
}

function stopScanner() {
  if (codeReader) {
    codeReader.reset();
    codeReader = null;
  }
  scannerActive = false;
  lastScanned = '';
  document.getElementById('scan-region').style.display = 'none';
  document.getElementById('video-el').srcObject = null;
  document.getElementById('cam-placeholder').style.display = 'block';
  document.getElementById('start-btn').style.display = 'block';
  document.getElementById('stop-btn').style.display = 'none';
  setStatus('Scanner stopped');
}

function lookupManual() {
  var val = document.getElementById('manual-barcode').value.trim();
  if (!val) {
    showToast('Please enter a barcode number.');
    return;
  }
  lookupBarcode(val);
}

// lookup query by primary key
// barcode (key) -> food database (lookup) 
async function lookupBarcode(code) {
  setStatus('Found barcode: ' + code + ' — looking up...', 'loading');
  stopScanner();

  try {
    var url = 'https://world.openfoodfacts.org/api/v0/product/' + code + '.json';
    var response = await fetch(url);
    var data = await response.json();

    if (data.status === 0 || !data.product) {
      setStatus('Product not found. Try another barcode.', 'error');
      return;
    }

    var p = data.product;
    var n = p.nutriments || {};

    var parsed = {
      product: p.product_name || 'Unknown Product',
      brand: p.brands || '',
      serving: p.serving_size ? 'Serving: ' + p.serving_size : 'Per 100g',
      calories: Math.round(n['energy-kcal_100g'] || 0),
      protein_g: Math.round((n.proteins_100g || 0) * 10) / 10,
      sat_fat_g: Math.round((n['saturated-fat_100g'] || 0) * 10) / 10,
      total_sugar_g: Math.round((n.sugars_100g || 0) * 10) / 10,
      fiber_g: Math.round((n.fiber_100g || 0) * 10) / 10,
      fat_g: Math.round((n.fat_100g || 0) * 10) / 10,
      carbs_g: Math.round((n.carbohydrates_100g || 0) * 10) / 10,
      sodium_mg: Math.round((n.sodium_100g || 0) * 1000),
      barcode: code
    };

    setStatus('Product found: ' + parsed.product, 'found');
    showResults(parsed);

  } catch(e) {
    setStatus('Network error. Check your connection.', 'error');
  }
}

// Popup notifications addition
var toastTimer;

function showToast(msg) {
  var t = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() {
    t.classList.remove('show');
  }, 3000);
}

// Display results in the UI
function showResults(d) {
  document.getElementById('results-empty').style.display = 'none';
  document.getElementById('results-content').style.display = 'block';

  document.getElementById('res-product').textContent = d.product;
  document.getElementById('res-brand').textContent = d.brand;
  document.getElementById('res-serving').textContent = d.serving;
  document.getElementById('res-cal').textContent = d.calories || '—';
  document.getElementById('res-prot').textContent = d.protein_g + 'g';
  document.getElementById('res-satfat').textContent = d.sat_fat_g + 'g';
  document.getElementById('res-sugar').textContent = d.total_sugar_g + 'g';

  document.getElementById('res-cal-dv').textContent = d.calories ? Math.round(d.calories / 2000 * 100) + '% daily' : '';
  document.getElementById('res-prot-dv').textContent = d.protein_g ? Math.round(d.protein_g / 50 * 100) + '% daily' : '';
  document.getElementById('res-satfat-dv').textContent = d.sat_fat_g ? Math.round(d.sat_fat_g / 20 * 100) + '% daily' : '';
  document.getElementById('res-sugar-dv').textContent = d.total_sugar_g ? Math.round(d.total_sugar_g / 50 * 100) + '% daily' : '';

  var extras = document.getElementById('nutrient-extras');
  extras.innerHTML = '';
  if (d.fiber_g) extras.innerHTML += '<div class="nutrient-chip">Fiber <span>' + d.fiber_g + 'g</span></div>';
  if (d.fat_g) extras.innerHTML += '<div class="nutrient-chip">Total Fat <span>' + d.fat_g + 'g</span></div>';
  if (d.carbs_g) extras.innerHTML += '<div class="nutrient-chip">Carbs <span>' + d.carbs_g + 'g</span></div>';
  if (d.sodium_mg) extras.innerHTML += '<div class="nutrient-chip">Sodium <span>' + d.sodium_mg + 'mg</span></div>';

  var ev = evaluateGoalFit(d);
  var fitBox = document.getElementById('goal-fit-box');
  fitBox.className = 'goal-fit ' + ev.fit;
  document.getElementById('goal-fit-label').textContent = ev.label;
  document.getElementById('goal-fit-text').textContent = ev.text;
  d.goal_fit = ev.fit;

  currentScanData = d;
}

function evaluateGoalFit(d) {
  var goal = getEffectiveGoal();
  var score = 0;
  var issues = [];

  if (d.protein_g >= goal.minProtein) { score++; }
  else { issues.push('protein below target (' + goal.minProtein + 'g)'); }

  if (d.calories <= goal.maxCal) { score++; }
  else { issues.push('calories above target'); }

  if (d.sat_fat_g <= goal.maxSatFat) { score++; }
  else { issues.push('saturated fat above target'); }

  if (d.total_sugar_g <= goal.maxSugar) { score++; }
  else { issues.push('sugar above target'); }

  var fit = score >= 3 ? 'good' : score >= 2 ? 'ok' : 'watch';
  var label = fit === 'good' ? 'Great Fit' : fit === 'watch' ? 'Use Caution' : 'Moderate Fit';
  var text = fit === 'good'
    ? 'This product aligns well with your ' + goal.name + ' goal.'
    : 'Note: ' + issues.join(', ') + '.';

  return { fit: fit, label: label, text: text };
}

function resetScan() {
  document.getElementById('results-empty').style.display = 'block';
  document.getElementById('results-content').style.display = 'none';
  currentScanData = null;
  lastScanned = '';
  setStatus('Ready to scan');
  document.getElementById('manual-barcode').value = '';
}
