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
