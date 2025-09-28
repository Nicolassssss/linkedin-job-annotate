if (!document.getElementById('linkedin-job-annotate-style')) {
  const style = document.createElement('style');
  style.id = 'linkedin-job-annotate-style';
  style.textContent = `
    .my-job-annotate-btn {
      background: #f3ad34;
      border: none;
      border-radius: 4px;
      color: #2d2d2d;
      padding: 3px 8px;
      font-size: 13px;
      cursor: pointer;
      margin-left: 6px;
    }
    .my-job-annotate-btn:hover {
      background: #ffd45c;
    }
    .my-job-annotate-box {
      position: fixed;
      z-index: 10000;
      background: #fffbe7;
      border: 1px solid #c9c9a3;
      padding: 10px;
      border-radius: 8px;
      width: 270px;
      box-shadow: 2px 2px 10px rgba(0,0,0,0.15);
    }
    .my-job-float-note {
      position: absolute;
      z-index: 9999;
      background: #e3effa;
      border: 1px solid #7a9bc7;
      padding: 8px;
      border-radius: 6px;
      box-shadow: 1px 1px 8px rgba(0,0,0,0.06);
      top: 10px;
      left: 10px;
      min-width: 180px;
      max-width: 260px;
    }
  `;
  document.head.appendChild(style);
}

console.log('LinkedIn 註解插件content.js啟動');

let isAnnotateBoxOpen = false;
const processedJobNodes = new WeakSet();

function getJobInfo(node) {
  const jobTitle = node.querySelector('a.job-card-list__title--link')?.innerText || '';
  const companyName = node.querySelector('.artdeco-entity-lockup__subtitle span')?.innerText 
                   || node.querySelector('.artdeco-entity-lockup__subtitle')?.innerText
                   || '';
  return { jobTitle, companyName };
}

function jobKey(info) {
  return btoa(encodeURIComponent(info.companyName + '|' + info.jobTitle));
}

function addAnnotateButtonToNode(node) {
  if (processedJobNodes.has(node)) return;

  const btn = document.createElement('button');
  btn.innerText = '備註';
  btn.className = 'my-job-annotate-btn';
  btn.style.cursor = 'pointer';
  btn.style.marginLeft = '6px';
  btn.onclick = function (e) {
    e.stopPropagation();
    showAnnotateBox(node);
  };

  const titleLink = node.querySelector('a.job-card-list__title--link');
  if (titleLink?.parentNode) {
    titleLink.parentNode.appendChild(btn);
  } else {
    node.appendChild(btn);
  }

  node.addEventListener('mouseenter', () => {
    node.style.position = 'relative';
    showFloatingNote(node);
  });

  node.addEventListener('mouseleave', removeFloatingNote);

  processedJobNodes.add(node);
}

const observerOptions = {
  root: null,
  rootMargin: '0px',
  threshold: 0.1
};

const intersectionObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      addAnnotateButtonToNode(entry.target);
      intersectionObserver.unobserve(entry.target);
    }
  })
}, observerOptions);

function observeJobCards() {
  const jobNodes = document.querySelectorAll('.job-card-container');
  jobNodes.forEach(node => {
    if (!processedJobNodes.has(node)) {
      intersectionObserver.observe(node);
    }
  });
}

const mutationObserver = new MutationObserver(() => {
  observeJobCards();
});

// 監控整個body的新增或刪除節點，動態捕捉新加入的職缺卡
mutationObserver.observe(document.body, { childList: true, subtree: true });

// 初始化監控現有職缺卡
observeJobCards();

function showAnnotateBox(node) {
  isAnnotateBoxOpen = true;
  removeExistingBox();

  const info = getJobInfo(node);
  const key = jobKey(info);

  chrome.storage.local.get([key], (result) => {
    const note = result[key] || {};
    const box = document.createElement('div');
    box.className = 'my-job-annotate-box';

    const rect = node.getBoundingClientRect();
    box.style.top = `${rect.bottom + window.scrollY + 5}px`;
    box.style.left = `${rect.left + window.scrollX}px`;

    box.innerHTML = `
      <div><b>${info.jobTitle}</b> - <span>${info.companyName}</span></div>
      <textarea placeholder="輸入備註類型與說明..." rows="3" cols="30">${note.text || ''}</textarea>
      <div style="margin-top: 6px;">
          <button class="my-job-annotate-save">儲存</button>
          <button class="my-job-annotate-cancel">取消</button>
      </div>
    `;

    document.body.appendChild(box);

    box.querySelector('.my-job-annotate-save').onclick = () => {
      const text = box.querySelector('textarea').value;
      chrome.storage.local.set({
        [key]: {
          text,
          time: new Date().toLocaleString(),
          jobTitle: info.jobTitle,
          companyName: info.companyName
        }
      }, () => {
        removeExistingBox();
      });
    };

    box.querySelector('.my-job-annotate-cancel').onclick = removeExistingBox;
  });
}

function removeExistingBox() {
  document.querySelectorAll('.my-job-annotate-box').forEach(e => e.remove());
  isAnnotateBoxOpen = false;
}

function showFloatingNote(node) {
  const info = getJobInfo(node);
  const key = jobKey(info);

  chrome.storage.local.get([key], (result) => {
    removeFloatingNote();

    if (!result[key] || !result[key].text) return;

    const { text, time } = result[key];
    const noteDiv = document.createElement('div');
    noteDiv.className = 'my-job-float-note';
    noteDiv.style.position = 'absolute';
    noteDiv.style.top = '10px';
    noteDiv.style.left = '10px';
    noteDiv.style.background = '#e3effa';
    noteDiv.style.border = '1px solid #7a9bc7';
    noteDiv.style.padding = '8px';
    noteDiv.style.borderRadius = '6px';
    noteDiv.style.zIndex = '9999';
    noteDiv.style.boxShadow = '1px 1px 8px rgba(0,0,0,0.3)';
    noteDiv.innerHTML = `<b>備註</b>: ${text} <br/><span style="font-size:0.8em;">${time}</span>`;
    node.style.position = 'relative';
    node.appendChild(noteDiv);
  });
}

function removeFloatingNote() {
  document.querySelectorAll('.my-job-float-note').forEach(e => e.remove());
}
