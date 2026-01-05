/**
 * WEBカタログ - 見開きレイアウト
 * turn.js + jQuery UI Slider使用
 * 表紙/裏表紙（hard cover）対応版
 */

"use strict";

/* ==========================================================================
   定数定義
   ========================================================================== */
const CONFIG = {
  // 画像ページ（実データ）
  IMAGE_PAGES: 4,

  // 表紙/裏表紙（turn.js上のページとして追加）
  COVER_PAGES_FRONT: 2, // 表紙（表・裏）
  COVER_PAGES_BACK: 2, // 裏表紙（裏・表）

  IMAGE_BASE_PATH: "images/",
  IMAGE_FORMAT: "jpg",

  PRELOAD_RANGE: 2,
  GUIDE_STORAGE_KEY: "catalog_guide_shown",
  GUIDE_DISPLAY_DURATION: 3000,
  DEBOUNCE_DELAY: 150,
  DOUBLE_TAP_PREVENTION: 300,
  IMAGE_LOAD_TIMEOUT: 10000,
  RETRY_COUNT: 2,

  // ページ設定
  PAGE_WIDTH: 480,
  PAGE_HEIGHT: 600,

  // turn.js設定
  FLIP_DURATION: 800,
  ACCELERATION: true,
  GRADIENTS: true,
  AUTO_CENTER: true,
  ELEVATION: 50,
};

// turn.js 上の総ページ数（表紙 + 本文 + 裏表紙）
CONFIG.TOTAL_PAGES = CONFIG.COVER_PAGES_FRONT + CONFIG.IMAGE_PAGES + CONFIG.COVER_PAGES_BACK;

/* ==========================================================================
   状態管理
   ========================================================================== */
const state = {
  currentPage: 1, // turn.js上のページ（1始まり）
  loadedImages: new Set(), // 画像番号（1〜IMAGE_PAGES）
  failedImages: new Set(), // 画像番号（1〜IMAGE_PAGES）
  lastInteractionTime: 0,
  isInitialized: false,
  isSliderDragging: false,
};

/* ==========================================================================
   DOM要素キャッシュ
   ========================================================================== */
const elements = {
  flipbook: null,
  loadingOverlay: null,
  guideOverlay: null,
  slider: null,
  pageNumberSpan: null,
  totalPagesSpan: null,
};

/* ==========================================================================
   ユーティリティ
   ========================================================================== */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function preventDoubleExecution(callback, delay = CONFIG.DOUBLE_TAP_PREVENTION) {
  const now = Date.now();
  if (now - state.lastInteractionTime < delay) {
    return false;
  }
  state.lastInteractionTime = now;
  callback();
  return true;
}

/**
 * turn.jsページ → 画像ページかどうか
 */
function isImageTurnPage(turnPage) {
  return turnPage > CONFIG.COVER_PAGES_FRONT && turnPage <= CONFIG.COVER_PAGES_FRONT + CONFIG.IMAGE_PAGES;
}

/**
 * turn.jsページ → 画像番号（1〜IMAGE_PAGES）へ変換（画像ページ以外は null）
 */
function turnPageToImageNo(turnPage) {
  if (!isImageTurnPage(turnPage)) return null;
  return turnPage - CONFIG.COVER_PAGES_FRONT;
}

/**
 * 画像番号 → turn.jsページへ変換
 */
function imageNoToTurnPage(imgNo) {
  return imgNo + CONFIG.COVER_PAGES_FRONT;
}

/**
 * URLパラメータからページ番号を取得（turn.jsのページ番号）
 */
function getPageFromURL() {
  const params = new URLSearchParams(window.location.search);
  const pageNo = parseInt(params.get("pNo"), 10);

  if (isNaN(pageNo) || pageNo < 1 || pageNo > CONFIG.TOTAL_PAGES) {
    return 1;
  }
  return pageNo;
}

/**
 * URLパラメータを更新（turn.jsのページ番号）
 */
function updateURL(pageNo) {
  const url = new URL(window.location);
  url.searchParams.set("pNo", pageNo);
  window.history.replaceState({}, "", url);
}

/**
 * 画像パスを生成（imgNo: 1〜IMAGE_PAGES）
 */
function getImagePath(imgNo) {
  const paddedNo = String(imgNo).padStart(2, "0");
  return `${CONFIG.IMAGE_BASE_PATH}page-${paddedNo}.${CONFIG.IMAGE_FORMAT}`;
}

/* ==========================================================================
   画像管理
   ========================================================================== */
function preloadImage(imgNo) {
  return new Promise((resolve, reject) => {
    if (imgNo < 1 || imgNo > CONFIG.IMAGE_PAGES) {
      resolve(imgNo);
      return;
    }
    if (state.loadedImages.has(imgNo) || state.failedImages.has(imgNo)) {
      resolve(imgNo);
      return;
    }

    const img = new Image();
    const imagePath = getImagePath(imgNo);
    let retryCount = 0;

    const timeoutId = setTimeout(() => {
      img.src = "";
      reject(new Error(`Image load timeout: ${imagePath}`));
    }, CONFIG.IMAGE_LOAD_TIMEOUT);

    img.onload = () => {
      clearTimeout(timeoutId);
      state.loadedImages.add(imgNo);
      resolve(imgNo);
    };

    img.onerror = () => {
      clearTimeout(timeoutId);
      if (retryCount < CONFIG.RETRY_COUNT) {
        retryCount++;
        console.warn(`Retrying image load (${retryCount}/${CONFIG.RETRY_COUNT}): ${imagePath}`);
        img.src = `${imagePath}?retry=${retryCount}&t=${Date.now()}`;
      } else {
        state.failedImages.add(imgNo);
        reject(new Error(`Failed to load image: ${imagePath}`));
      }
    };

    img.src = imagePath;
  });
}

/**
 * 現在の見開きに近い画像を優先プリロード
 * - 表紙/裏表紙にいるときは最初/最後の画像を優先
 */
async function preloadPriorityImages() {
  const turnPage = state.currentPage;

  const priorityImages = new Set();

  // いま見えているページ（view）から画像番号を拾う
  const view = $("#flipbook").turn("view") || [];
  view.forEach((p) => {
    const imgNo = turnPageToImageNo(p);
    if (imgNo) priorityImages.add(imgNo);
  });

  // 近傍（PRELOAD_RANGE）も拾う（turn.jsページ→画像番号）
  for (let i = 1; i <= CONFIG.PRELOAD_RANGE; i++) {
    const imgNoPrev = turnPageToImageNo(turnPage - i);
    const imgNoNext = turnPageToImageNo(turnPage + i);
    if (imgNoPrev) priorityImages.add(imgNoPrev);
    if (imgNoNext) priorityImages.add(imgNoNext);

    // 見開きの反対側も意識して +1 も拾う
    const imgNoNextPair = turnPageToImageNo(turnPage + i + 1);
    if (imgNoNextPair) priorityImages.add(imgNoNextPair);
  }

  // 表紙側にいるときは先頭の画像を優先
  if (turnPage <= CONFIG.COVER_PAGES_FRONT) {
    priorityImages.add(1);
    priorityImages.add(2);
  }

  // 裏表紙側にいるときは末尾の画像を優先
  const backCoverStart = CONFIG.TOTAL_PAGES - CONFIG.COVER_PAGES_BACK + 1;
  if (turnPage >= backCoverStart) {
    priorityImages.add(CONFIG.IMAGE_PAGES);
    priorityImages.add(CONFIG.IMAGE_PAGES - 1);
  }

  try {
    await Promise.all([...priorityImages].map((n) => preloadImage(n)));
  } catch (error) {
    console.warn("Priority preload partially failed:", error);
  }
}

function preloadRemainingImages() {
  const requestIdleCallback = window.requestIdleCallback || ((cb) => setTimeout(cb, 1));

  requestIdleCallback(async () => {
    for (let i = 1; i <= CONFIG.IMAGE_PAGES; i++) {
      if (!state.loadedImages.has(i) && !state.failedImages.has(i)) {
        try {
          await preloadImage(i);
        } catch (error) {
          // エラーは記録済み
        }
      }
    }
  });
}

/* ==========================================================================
   ページ生成
   ========================================================================== */
function createPageElement(turnPageNo) {
  const page = $("<div>", {
    class: "page",
    "data-page": turnPageNo,
  });

  // 表紙（1,2）
  if (turnPageNo <= CONFIG.COVER_PAGES_FRONT) {
    page.addClass("hard");
    const text = turnPageNo === 1 ? "TABLE ACCESSORIES\nPRODUCT CATALOG" : "";

    page.append(
      $("<div>", {
        class: "cover-content",
        text,
      })
    );

    // 表紙 裏
    if (turnPageNo === 2) {
      page.append(
        $("<div>", {
          class: "cover-inside",
          html: `
          <h2>About this catalog</h2>
          <p>
            This catalog introduces our latest table accessories,
            designed for professional and commercial use.
          </p>
          <p>
            All products are available for bulk orders
            and custom specifications.
          </p>
        `,
        })
      );
    }
    return page;
  }

  // 裏表紙（最後の2枚）
  const backCoverStart = CONFIG.TOTAL_PAGES - CONFIG.COVER_PAGES_BACK + 1;
  if (turnPageNo >= backCoverStart) {
    page.addClass("hard");

    // 裏表紙の裏（テキストページ）
    if (turnPageNo === CONFIG.TOTAL_PAGES - 1) {
      page.append(
        $("<div>", {
          class: "cover-inside",
          html: `
          <h2>Company Information</h2>
          <p>
            Thank you for viewing our catalog.<br>
            For inquiries, please contact us using the information below.
          </p>
          <p>
            Email: info@example.com<br>
            Website: www.example.com
          </p>
        `,
        })
      );
    }

    // 裏表紙（最後のページ）
    if (turnPageNo === CONFIG.TOTAL_PAGES) {
      page.append(
        $("<div>", {
          class: "cover-content",
          text: "Thank you",
        })
      );
    }

    return page;
  }

  // 本文（画像ページ）
  const imgNo = turnPageToImageNo(turnPageNo);

  const content = $("<div>", { class: "page-content" });

  const img = $("<img>", {
    class: "page-image",
    alt: `Page ${imgNo}`,
    "data-page": turnPageNo,
    src: getImagePath(imgNo),
  });

  img.on("load", function () {
    $(this).addClass("loaded");
    state.loadedImages.add(imgNo);
  });

  img.on("error", function () {
    $(this).addClass("error");
    const errorDiv = $("<div>", {
      class: "page-error",
      html: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <p>Failed to load</p>
      `,
    });
    content.append(errorDiv);
    state.failedImages.add(imgNo);
  });

  content.append(img);
  page.append(content);

  return page;
}

function renderAllPages() {
  const flipbook = $("#flipbook");
  for (let p = 1; p <= CONFIG.TOTAL_PAGES; p++) {
    flipbook.append(createPageElement(p));
  }
}

/* ==========================================================================
   turn.js初期化
   ========================================================================== */
function initializeTurnJS() {
  const flipbook = $("#flipbook");

  flipbook.turn({
    width: CONFIG.PAGE_WIDTH * 2,
    height: CONFIG.PAGE_HEIGHT,
    autoCenter: CONFIG.AUTO_CENTER,
    duration: CONFIG.FLIP_DURATION,
    acceleration: CONFIG.ACCELERATION,
    gradients: CONFIG.GRADIENTS,
    elevation: CONFIG.ELEVATION,
    pages: CONFIG.TOTAL_PAGES,

    when: {
      turning: function (event, page, view) {
        state.currentPage = page;
      },

      turned: function (event, page, view) {
        state.currentPage = page;
        updatePageIndicator(page);
        updateSlider(page);
        updateURL(page);
        preloadPriorityImages();
      },

      missing: function (event, pages) {
        console.warn("Missing pages:", pages);
      },
    },
  });

  state.isInitialized = true;
}

/* ==========================================================================
   ページ制御
   ========================================================================== */
function goToPage(pageNo) {
  if (!state.isInitialized) return;
  if (pageNo < 1 || pageNo > CONFIG.TOTAL_PAGES) return;
  $("#flipbook").turn("page", pageNo);
}

function nextPage() {
  preventDoubleExecution(() => $("#flipbook").turn("next"));
}

function prevPage() {
  preventDoubleExecution(() => $("#flipbook").turn("previous"));
}

/**
 * ページ表示（見開き表示を「画像番号ベース」で表示）
 * - 表紙は「Cover」
 * - 裏表紙は「Back cover」
 * - 本文は「1-2」など
 */
function updatePageIndicator(turnPage) {
  const view = $("#flipbook").turn("view") || [];

  // viewが2ページの場合、両方を画像番号へ変換
  if (view.length === 2) {
    const leftImg = turnPageToImageNo(view[0]);
    const rightImg = turnPageToImageNo(view[1]);

    // 両方画像なら 1-2 の形式
    if (leftImg && rightImg) {
      elements.pageNumberSpan.text(`${leftImg}-${rightImg}`);
      return;
    }

    // 片方だけ画像（表紙/裏表紙と混ざる場合）
    if (leftImg && !rightImg) {
      elements.pageNumberSpan.text(`${leftImg}`);
      return;
    }
    if (!leftImg && rightImg) {
      elements.pageNumberSpan.text(`${rightImg}`);
      return;
    }

    // 両方とも表紙側
    if (view[1] <= CONFIG.COVER_PAGES_FRONT) {
      elements.pageNumberSpan.text("Cover");
      return;
    }

    // 両方とも裏表紙側
    const backCoverStart = CONFIG.TOTAL_PAGES - CONFIG.COVER_PAGES_BACK + 1;
    if (view[0] >= backCoverStart) {
      elements.pageNumberSpan.text("Back cover");
      return;
    }
  }

  // 単ページの場合
  const imgNo = turnPageToImageNo(turnPage);
  if (imgNo) {
    elements.pageNumberSpan.text(`${imgNo}`);
    return;
  }

  if (turnPage <= CONFIG.COVER_PAGES_FRONT) {
    elements.pageNumberSpan.text("Cover");
    return;
  }

  const backCoverStart = CONFIG.TOTAL_PAGES - CONFIG.COVER_PAGES_BACK + 1;
  if (turnPage >= backCoverStart) {
    elements.pageNumberSpan.text("Back cover");
    return;
  }

  elements.pageNumberSpan.text(`${turnPage}`);
}

function updateSlider(page) {
  if (!state.isSliderDragging && elements.slider && elements.slider.hasClass("ui-slider")) {
    elements.slider.slider("value", page);
  }
}

/* ==========================================================================
   スライダー初期化
   ========================================================================== */
function initializeSlider() {
  elements.slider = $("#slider");

  elements.slider.slider({
    min: 1,
    max: CONFIG.TOTAL_PAGES,
    value: 1,

    start: function () {
      state.isSliderDragging = true;
    },

    slide: function (event, ui) {
      const turnPage = ui.value;
      state.currentPage = turnPage;
      updatePageIndicator(turnPage);
    },

    stop: function (event, ui) {
      state.isSliderDragging = false;
      goToPage(ui.value);
    },
  });
}

/* ==========================================================================
   リサイズ対応
   ========================================================================== */
function handleResize() {
  if (!state.isInitialized) return;
  $("#flipbook").turn("size", CONFIG.PAGE_WIDTH * 2, CONFIG.PAGE_HEIGHT);
}

/* ==========================================================================
   初回ガイド
   ========================================================================== */
function showGuideIfFirstVisit() {
  const hasSeenGuide = localStorage.getItem(CONFIG.GUIDE_STORAGE_KEY);

  if (!hasSeenGuide) {
    setTimeout(() => {
      elements.guideOverlay.removeClass("hidden");

      setTimeout(() => {
        elements.guideOverlay.addClass("hidden");
        localStorage.setItem(CONFIG.GUIDE_STORAGE_KEY, "true");
      }, CONFIG.GUIDE_DISPLAY_DURATION);
    }, 500);
  }
}

/* ==========================================================================
   イベントリスナー
   ========================================================================== */
function setupEventListeners() {
  $(document).on("keydown", function (e) {
    if (e.key === "ArrowLeft") prevPage();
    if (e.key === "ArrowRight") nextPage();
  });

  elements.guideOverlay.on("click", function () {
    $(this).addClass("hidden");
    localStorage.setItem(CONFIG.GUIDE_STORAGE_KEY, "true");
  });

  $(window).on("resize", debounce(handleResize, CONFIG.DEBOUNCE_DELAY));
}

/* ==========================================================================
   初期化
   ========================================================================== */
function cacheElements() {
  elements.flipbook = $("#flipbook");
  elements.loadingOverlay = $("#loadingOverlay");
  elements.guideOverlay = $("#guideOverlay");
  elements.slider = $("#slider");
  elements.pageNumberSpan = $("#page-number");
  elements.totalPagesSpan = $("#total-pages");
}

async function initialize() {
  try {
    if (typeof jQuery === "undefined") throw new Error("jQuery library not loaded");
    if (typeof $.fn.turn === "undefined") throw new Error("turn.js library not loaded");
    if (typeof $.fn.slider === "undefined") throw new Error("jQuery UI library not loaded");

    cacheElements();

    // 右側の「総ページ数表示」は、画像枚数のままにする（好みで TOTAL_PAGES にしてもOK）
    elements.totalPagesSpan.text(CONFIG.IMAGE_PAGES);

    renderAllPages();
    initializeTurnJS();
    setupEventListeners();

    const initialPageFromURL = getPageFromURL();
    initializeSlider();

    // 初期表示：
    // - 表紙から開始したい → 1
    // - 本文（画像1-2）から開始したい → imageNoToTurnPage(1) = 3
    const initialPage = initialPageFromURL; // ここを 1 や 3 に固定してもOK

    setTimeout(() => {
      goToPage(initialPage);
      updatePageIndicator(initialPage);
      updateSlider(initialPage);
    }, 100);

    await preloadPriorityImages();

    setTimeout(() => {
      elements.loadingOverlay.addClass("hidden");
    }, 500);

    showGuideIfFirstVisit();
    preloadRemainingImages();

    console.log("Catalog initialized successfully (hard cover enabled)");
  } catch (error) {
    console.error("Initialization failed:", error);

    const errorMessage = error.message || "Unknown error";
    const loadingText = $("#loadingOverlay .loading-text");

    if (loadingText.length) {
      if (errorMessage.includes("jQuery") && !errorMessage.includes("UI")) {
        loadingText.html(`
          Failed to load jQuery library.<br>
          <small>Please check that libs/jquery.min.js exists.</small>
        `);
      } else if (errorMessage.includes("jQuery UI")) {
        loadingText.html(`
          Failed to load jQuery UI library.<br>
          <small>Please check the jQuery UI CDN connection.</small>
        `);
      } else if (errorMessage.includes("turn.js")) {
        loadingText.html(`
          Failed to load turn.js library.<br>
          <small>Please check that libs/turn.min.js exists.</small>
        `);
      } else {
        loadingText.html(`
          Failed to load catalog.<br>
          <small>${errorMessage}</small><br>
          <small>Please refresh the page.</small>
        `);
      }
    }

    console.error("Debug info:", {
      hasJQuery: typeof jQuery !== "undefined",
      hasTurnJS: typeof $.fn.turn !== "undefined",
      hasJQueryUI: typeof $.fn.slider !== "undefined",
      error,
    });
  }
}

/* ==========================================================================
   エントリーポイント
   ========================================================================== */
$(document).ready(function () {
  initialize();
});

// デバッグ用
if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
  window.catalogDebug = {
    state,
    goToPage,
    preloadImage,
    CONFIG,
    flipbook: () => $("#flipbook"),
    slider: () => $("#slider"),
    helpers: { isImageTurnPage, turnPageToImageNo, imageNoToTurnPage },
  };
}
