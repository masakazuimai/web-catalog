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
  // 画像ページ（実データ）- page-02〜page-07の6ページ
  IMAGE_PAGES: 6,

  // 表紙/裏表紙（turn.js上のページとして追加）
  COVER_PAGES_FRONT: 2, // 表紙（表・裏）
  COVER_PAGES_BACK: 2, // 裏表紙（裏・表）

  IMAGE_BASE_PATH: "images/",
  IMAGE_FORMAT: "jpeg",
  COVER_IMAGE: "images/page-01.jpeg", // 表紙画像

  PRELOAD_RANGE: 2,
  GUIDE_STORAGE_KEY: "catalog_guide_shown",
  GUIDE_DISPLAY_DURATION: 3000,
  DEBOUNCE_DELAY: 150,
  DOUBLE_TAP_PREVENTION: 300,
  IMAGE_LOAD_TIMEOUT: 10000,
  RETRY_COUNT: 2,

  // ページ設定（A4サイズ比率: 210mm × 297mm）
  PAGE_WIDTH: 595,
  PAGE_HEIGHT: 842,

  // turn.js設定
  FLIP_DURATION: 800,
  ACCELERATION: true,
  GRADIENTS: true,
  AUTO_CENTER: true,
  ELEVATION: 50,

  // サイドバー設定
  SIDEBAR_STORAGE_KEY: "catalog_sidebar_state",
  THUMBNAIL_SIZE: {
    WIDTH: 240,
    HEIGHT: 300,
  },

  // メモ設定
  NOTES_STORAGE_KEY: "catalog_notes",
  NOTES_AUTOSAVE_DELAY: 1000, // 1秒後に自動保存

  // 付箋設定
  STICKY_STORAGE_KEY: "catalog_sticky_notes",
  STICKY_COLORS: ["#fef68a", "#fda4af", "#a5f3fc", "#a7f3d0", "#e9d5ff"],
  STICKY_DEFAULT_COLOR: "#fef68a",
  STICKY_WIDTH: 200,
  STICKY_MIN_HEIGHT: 150,
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
  sidebarOpen: false, // サイドバーの開閉状態
  thumbnailsGenerated: false, // サムネイル生成済みフラグ
  notesOpen: false, // メモエリアの開閉状態
  notesSaveTimeout: null, // メモ自動保存タイマー
  stickyNotes: {}, // ページごとの付箋データ { pageNo: [stickyNote, ...] }
  stickyCounter: 0, // 付箋のユニークID生成用
  draggedSticky: null, // ドラッグ中の付箋
  stickyModeEnabled: false, // 付箋追加モード
  stickyListOpen: false, // 付箋一覧パネルの開閉状態
  hamburgerMenuOpen: false, // ハンバーガーメニューの開閉状態
  zoomLevel: 1, // ズームレベル（1 = 100%）
  zoomMin: 0.5, // 最小ズーム（50%）
  zoomMax: 3, // 最大ズーム（300%）
  zoomStep: 0.25, // ズーム増減幅（25%）
  isPanning: false, // パン操作中フラグ
  panStartX: 0, // パン開始X座標
  panStartY: 0, // パン開始Y座標
  panOffsetX: 0, // パンのオフセットX
  panOffsetY: 0, // パンのオフセットY
};

/* ==========================================================================
   DOM要素キャッシュ
   ========================================================================== */
const elements = {
  flipbook: null,
  loadingOverlay: null,
  guideOverlay: null,
  slider: null,
  sidebar: null,
  sidebarToggleBtn: null,
  sidebarCloseBtn: null,
  thumbnailContainer: null,
  sidebarOverlay: null,
  notesToggleBtn: null,
  notesPanel: null,
  notesPanelCloseBtn: null,
  notesTextarea: null,
  notesStatus: null,
  stickyToggleBtn: null,
  stickyListToggleBtn: null,
  stickyListPanel: null,
  stickyListPanelCloseBtn: null,
  stickyListContainer: null,
  sidebarPageNumberSpan: null,
  sidebarTotalPagesSpan: null,
  sidebarPrevBtn: null,
  sidebarNextBtn: null,
  sidebarFirstPageBtn: null,
  sidebarLastPageBtn: null,
  pageJumpInput: null,
  pageJumpBtn: null,
  zoomInBtn: null,
  zoomOutBtn: null,
  zoomResetBtn: null,
  bookZoom: null,
  hamburgerMenuBtn: null,
  hamburgerMenu: null,
  hamburgerMenuCloseBtn: null,
  hamburgerOverlay: null,
  hamburgerPageNumberSpan: null,
  hamburgerTotalPagesSpan: null,
  hamburgerPrevBtn: null,
  hamburgerNextBtn: null,
  hamburgerFirstPageBtn: null,
  hamburgerLastPageBtn: null,
  hamburgerSidebarBtn: null,
  hamburgerNotesBtn: null,
  hamburgerStickyBtn: null,
  hamburgerStickyListBtn: null,
  mobilePageNumberSpan: null,
  mobileTotalPagesSpan: null,
  mobilePrevBtn: null,
  mobileNextBtn: null,
  mobileFirstPageBtn: null,
  mobileLastPageBtn: null,
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
 * 本文ページはpage-02から始まる（page-01は表紙用）
 */
function getImagePath(imgNo) {
  const actualPageNo = imgNo + 1; // imgNo=1 → page-02, imgNo=2 → page-03, ...
  const paddedNo = String(actualPageNo).padStart(2, "0");
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
   サムネイル管理
   ========================================================================== */
/**
 * 全ページのサムネイルを生成（最初/最後は単独、中間は見開き）
 */
function generateThumbnails() {
  if (state.thumbnailsGenerated) return;

  const container = elements.thumbnailContainer;
  container.empty();

  const startPage = CONFIG.COVER_PAGES_FRONT + 1; // turn.jsページ3
  const endPage = CONFIG.COVER_PAGES_FRONT + CONFIG.IMAGE_PAGES; // turn.jsページ6

  // 最初のページ（画像1）は単独
  const firstItem = createSingleThumbnailItem(startPage);
  container.append(firstItem);

  // 中間ページは見開き（画像2-3）
  if (CONFIG.IMAGE_PAGES > 2) {
    for (let turnPage = startPage + 1; turnPage < endPage; turnPage += 2) {
      const item = createSpreadThumbnailItem(turnPage);
      container.append(item);
    }
  }

  // 最後のページ（画像4）は単独
  if (CONFIG.IMAGE_PAGES > 1) {
    const lastItem = createSingleThumbnailItem(endPage);
    container.append(lastItem);
  }

  state.thumbnailsGenerated = true;
}

/**
 * 単独ページサムネイル要素を生成
 */
function createSingleThumbnailItem(turnPage) {
  const imgNo = turnPageToImageNo(turnPage);

  const item = $("<div>", {
    class: "thumbnail-item thumbnail-single",
    "data-turn-page": turnPage,
  });

  const wrapper = $("<div>", { class: "thumbnail-wrapper" });

  const img = $("<img>", {
    src: getImagePath(imgNo),
    alt: `Page ${imgNo}`,
    loading: "lazy",
  });

  img.on("error", function () {
    $(this).replaceWith(`
      <div class="thumbnail-placeholder" style="background: #ccc;">
        ${imgNo}
      </div>
    `);
  });

  wrapper.append(img);

  const label = $("<span>", {
    class: "thumbnail-label",
    text: imgNo.toString(),
  });

  item.append(wrapper, label);

  return item;
}

/**
 * 見開きサムネイル要素を生成
 */
function createSpreadThumbnailItem(leftTurnPage) {
  const rightTurnPage = leftTurnPage + 1;
  const leftImgNo = turnPageToImageNo(leftTurnPage);
  const rightImgNo = turnPageToImageNo(rightTurnPage);

  const item = $("<div>", {
    class: "thumbnail-item thumbnail-spread",
    "data-turn-page": leftTurnPage, // 見開きの左ページを基準にする
  });

  const wrapper = $("<div>", { class: "thumbnail-wrapper" });

  // 左ページ
  const leftImg = $("<img>", {
    src: getImagePath(leftImgNo),
    alt: `Page ${leftImgNo}`,
    loading: "lazy",
    class: "thumbnail-page-left",
  });

  leftImg.on("error", function () {
    $(this).replaceWith(`
      <div class="thumbnail-placeholder" style="background: #ccc; width: 50%;">
        ${leftImgNo}
      </div>
    `);
  });

  // 右ページ
  const rightImg = $("<img>", {
    src: getImagePath(rightImgNo),
    alt: `Page ${rightImgNo}`,
    loading: "lazy",
    class: "thumbnail-page-right",
  });

  rightImg.on("error", function () {
    $(this).replaceWith(`
      <div class="thumbnail-placeholder" style="background: #ccc; width: 50%;">
        ${rightImgNo}
      </div>
    `);
  });

  wrapper.append(leftImg, rightImg);

  // ラベルは「1-2」形式
  const label = $("<span>", {
    class: "thumbnail-label",
    text: `${leftImgNo}-${rightImgNo}`,
  });

  item.append(wrapper, label);

  return item;
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

    // 表紙 表（page-01.jpegを使用）
    if (turnPageNo === 1) {
      const content = $("<div>", { class: "page-content cover-page" });
      const img = $("<img>", {
        class: "page-image cover-image",
        alt: "Cover",
        src: CONFIG.COVER_IMAGE,
      });

      img.on("load", function () {
        $(this).addClass("loaded");
      });

      img.on("error", function () {
        $(this).addClass("error");
        // エラー時はテキストにフォールバック
        content.append(
          $("<div>", {
            class: "cover-content",
            text: "TABLE ACCESSORIES\nPRODUCT CATALOG",
          })
        );
      });

      content.append(img);
      page.append(content);
    }

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
  const size = calculateBookSize();

  flipbook.turn({
    width: size.width,
    height: size.height,
    display: size.display,
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
        updateNavigationButtons();
        updateSlider(page);
        updateURL(page);
        preloadPriorityImages();
        // ページめくり完了時にオフセットを更新
        updatePageViewOffset();

        // サムネイルハイライト更新
        if (state.thumbnailsGenerated) {
          updateThumbnailHighlight(page);
        }

        // 付箋を表示
        view.forEach((p) => {
          renderStickiesForPage(p);
        });
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
 * 本文の最初のページへジャンプ
 */
function goToFirstPage() {
  const firstContentPage = CONFIG.COVER_PAGES_FRONT + 1; // turn.jsページ3（画像1）
  preventDoubleExecution(() => goToPage(firstContentPage));
}

/**
 * 本文の最後のページへジャンプ
 */
function goToLastPage() {
  const lastContentPage = CONFIG.COVER_PAGES_FRONT + CONFIG.IMAGE_PAGES; // turn.jsページ6（画像4）
  preventDoubleExecution(() => goToPage(lastContentPage));
}

/**
 * 指定ページへジャンプ（画像番号で指定）
 */
function handlePageJump() {
  const input = elements.pageJumpInput;
  const imageNo = parseInt(input.val(), 10);

  // 入力チェック
  if (!imageNo || isNaN(imageNo)) {
    input.val("");
    return;
  }

  // 画像番号の範囲チェック（1 ~ IMAGE_PAGES）
  if (imageNo < 1 || imageNo > CONFIG.IMAGE_PAGES) {
    alert(`ページ番号は 1 から ${CONFIG.IMAGE_PAGES} の範囲で入力してください。`);
    input.val("");
    return;
  }

  // 画像番号をturn.jsページ番号に変換
  const turnPage = imageNoToTurnPage(imageNo);

  // ページジャンプ
  goToPage(turnPage);

  // 入力をクリア
  input.val("");

  // フォーカスを外す（モバイルでキーボードを閉じる）
  input.blur();
}

/* ==========================================================================
   ズーム機能
   ========================================================================== */
/**
 * 現在表示されているビューのタイプを判定
 * @returns 'front-cover' | 'back-cover' | 'spread'
 */
function getPageViewType() {
  const view = $("#flipbook").turn("view") || [];
  const backCoverStart = CONFIG.TOTAL_PAGES - CONFIG.COVER_PAGES_BACK + 1;

  // 表紙のみ表示（1ページ目のみ、または1-2ページの見開き）
  if (view.length > 0 && view.every(p => p === 0 || p <= CONFIG.COVER_PAGES_FRONT)) {
    return 'front-cover';
  }

  // 裏表紙のみ表示
  if (view.length > 0 && view.every(p => p === 0 || p >= backCoverStart)) {
    return 'back-cover';
  }

  return 'spread';
}

/**
 * 単ページ/見開き表示に応じたオフセットを更新
 */
function updatePageViewOffset() {
  const viewType = getPageViewType();

  // 全てのビュータイプクラスを削除
  elements.bookZoom.removeClass("spread-view back-cover-view");

  if (viewType === 'spread') {
    elements.bookZoom.addClass("spread-view");
  } else if (viewType === 'back-cover') {
    elements.bookZoom.addClass("back-cover-view");
  }
  // front-coverはデフォルト（クラスなし）

  // ズーム中の場合のみ再適用
  if (state.zoomLevel !== 1) {
    applyZoom();
  }
}

/**
 * ズームを適用
 */
function applyZoom() {
  const scale = state.zoomLevel;
  const translateX = state.panOffsetX;
  const translateY = state.panOffsetY;

  // ページタイプに応じたオフセット
  let pageOffsetX = "-16%"; // 表紙（デフォルト）
  if (elements.bookZoom.hasClass("spread-view")) {
    pageOffsetX = "3%"; // 見開きは少し右にオフセット
  } else if (elements.bookZoom.hasClass("back-cover-view")) {
    pageOffsetX = "18%"; // 裏表紙は右にオフセット
  }

  // ズーム中のみtransformを適用、それ以外はCSSに任せる
  if (scale !== 1 || translateX !== 0 || translateY !== 0) {
    elements.bookZoom.css({
      transform: `translateX(${pageOffsetX}) scale(${scale}) translate(${translateX}px, ${translateY}px)`,
      transformOrigin: "center center",
    });
  } else {
    // ズームなしの場合はCSSクラスに任せる
    elements.bookZoom.css("transform", "");
  }

  // ズーム時はクラスを追加（カーソル変更など）
  if (scale > 1) {
    elements.bookZoom.addClass("zoomed");
  } else {
    elements.bookZoom.removeClass("zoomed");
    // ズームがリセットされたらパンもリセット
    state.panOffsetX = 0;
    state.panOffsetY = 0;
  }
}

/**
 * ズームイン
 */
function zoomIn() {
  if (state.zoomLevel < state.zoomMax) {
    state.zoomLevel = Math.min(state.zoomLevel + state.zoomStep, state.zoomMax);
    applyZoom();
  }
}

/**
 * ズームアウト
 */
function zoomOut() {
  if (state.zoomLevel > state.zoomMin) {
    state.zoomLevel = Math.max(state.zoomLevel - state.zoomStep, state.zoomMin);
    applyZoom();
  }
}

/**
 * ズームリセット
 */
function zoomReset() {
  state.zoomLevel = 1;
  state.panOffsetX = 0;
  state.panOffsetY = 0;
  applyZoom();
}

/**
 * マウスホイールでズーム
 */
function handleWheelZoom(e) {
  // Ctrl/Cmdキーが押されている場合のみズーム
  if (!e.ctrlKey && !e.metaKey) return;

  e.preventDefault();

  const delta = e.originalEvent.deltaY;
  if (delta < 0) {
    // 上方向スクロール = ズームイン
    zoomIn();
  } else {
    // 下方向スクロール = ズームアウト
    zoomOut();
  }
}

/**
 * パン（ドラッグ移動）開始
 */
function startPan(e) {
  if (state.zoomLevel <= 1) return;

  state.isPanning = true;
  state.panStartX = e.clientX || e.touches[0].clientX;
  state.panStartY = e.clientY || e.touches[0].clientY;

  elements.bookZoom.css("transition", "none");
}

/**
 * パン中
 */
function doPan(e) {
  if (!state.isPanning) return;

  e.preventDefault();

  const clientX = e.clientX || (e.touches && e.touches[0].clientX);
  const clientY = e.clientY || (e.touches && e.touches[0].clientY);

  const deltaX = clientX - state.panStartX;
  const deltaY = clientY - state.panStartY;

  state.panOffsetX += deltaX / state.zoomLevel;
  state.panOffsetY += deltaY / state.zoomLevel;

  state.panStartX = clientX;
  state.panStartY = clientY;

  applyZoom();
}

/**
 * パン終了
 */
function endPan() {
  if (!state.isPanning) return;

  state.isPanning = false;
  elements.bookZoom.css("transition", "");
}

/**
 * ページ表示（見開き表示を「画像番号ベース」で表示）
 * - 表紙は「Cover」
 * - 裏表紙は「Back cover」
 * - 本文は「1-2」など
 */
function updatePageIndicator(turnPage) {
  const view = $("#flipbook").turn("view") || [];
  let displayText = "";

  // viewが2ページの場合、両方を画像番号へ変換
  if (view.length === 2) {
    const leftImg = turnPageToImageNo(view[0]);
    const rightImg = turnPageToImageNo(view[1]);

    // 両方画像なら 1-2 の形式
    if (leftImg && rightImg) {
      displayText = `${leftImg}-${rightImg}`;
    }
    // 片方だけ画像（表紙/裏表紙と混ざる場合）
    else if (leftImg && !rightImg) {
      displayText = `${leftImg}`;
    } else if (!leftImg && rightImg) {
      displayText = `${rightImg}`;
    }
    // 両方とも表紙側
    else if (view[1] <= CONFIG.COVER_PAGES_FRONT) {
      displayText = "Cover";
    }
    // 両方とも裏表紙側
    else {
      const backCoverStart = CONFIG.TOTAL_PAGES - CONFIG.COVER_PAGES_BACK + 1;
      if (view[0] >= backCoverStart) {
        displayText = "Back cover";
      } else {
        displayText = `${turnPage}`;
      }
    }
  } else {
    // 単ページの場合
    const imgNo = turnPageToImageNo(turnPage);
    if (imgNo) {
      displayText = `${imgNo}`;
    } else if (turnPage <= CONFIG.COVER_PAGES_FRONT) {
      displayText = "Cover";
    } else {
      const backCoverStart = CONFIG.TOTAL_PAGES - CONFIG.COVER_PAGES_BACK + 1;
      if (turnPage >= backCoverStart) {
        displayText = "Back cover";
      } else {
        displayText = `${turnPage}`;
      }
    }
  }

  // サイドバーのページ番号表示を更新
  if (elements.sidebarPageNumberSpan) {
    elements.sidebarPageNumberSpan.text(displayText);
  }

  // ハンバーガーメニューのページ番号表示を更新
  if (elements.hamburgerPageNumberSpan) {
    elements.hamburgerPageNumberSpan.text(displayText);
  }

  // モバイルナビゲーションのページ番号表示を更新
  if (elements.mobilePageNumberSpan) {
    elements.mobilePageNumberSpan.text(displayText);
  }
}

/**
 * ページナビゲーションボタンの状態を更新
 */
function updateNavigationButtons() {
  const currentPage = state.currentPage;
  const firstContentPage = CONFIG.COVER_PAGES_FRONT + 1;
  const lastContentPage = CONFIG.COVER_PAGES_FRONT + CONFIG.IMAGE_PAGES;

  // 左下固定ナビゲーション
  if (elements.sidebarPrevBtn && elements.sidebarNextBtn) {
    // 最初のページにいる場合、「前へ」ボタンを無効化
    if (currentPage <= 1) {
      elements.sidebarPrevBtn.prop("disabled", true);
    } else {
      elements.sidebarPrevBtn.prop("disabled", false);
    }

    // 最後のページにいる場合、「次へ」ボタンを無効化
    if (currentPage >= CONFIG.TOTAL_PAGES) {
      elements.sidebarNextBtn.prop("disabled", true);
    } else {
      elements.sidebarNextBtn.prop("disabled", false);
    }

    // ジャンプボタンの状態更新
    if (elements.sidebarFirstPageBtn && elements.sidebarLastPageBtn) {
      // 本文の最初のページにいる場合、「最初へ」ボタンを無効化
      if (currentPage <= firstContentPage) {
        elements.sidebarFirstPageBtn.prop("disabled", true);
      } else {
        elements.sidebarFirstPageBtn.prop("disabled", false);
      }

      // 本文の最後のページにいる場合、「最後へ」ボタンを無効化
      if (currentPage >= lastContentPage) {
        elements.sidebarLastPageBtn.prop("disabled", true);
      } else {
        elements.sidebarLastPageBtn.prop("disabled", false);
      }
    }
  }

  // ハンバーガーメニュー内のナビゲーション
  if (elements.hamburgerPrevBtn && elements.hamburgerNextBtn) {
    if (currentPage <= 1) {
      elements.hamburgerPrevBtn.prop("disabled", true);
    } else {
      elements.hamburgerPrevBtn.prop("disabled", false);
    }

    if (currentPage >= CONFIG.TOTAL_PAGES) {
      elements.hamburgerNextBtn.prop("disabled", true);
    } else {
      elements.hamburgerNextBtn.prop("disabled", false);
    }

    if (elements.hamburgerFirstPageBtn && elements.hamburgerLastPageBtn) {
      if (currentPage <= firstContentPage) {
        elements.hamburgerFirstPageBtn.prop("disabled", true);
      } else {
        elements.hamburgerFirstPageBtn.prop("disabled", false);
      }

      if (currentPage >= lastContentPage) {
        elements.hamburgerLastPageBtn.prop("disabled", true);
      } else {
        elements.hamburgerLastPageBtn.prop("disabled", false);
      }
    }
  }

  // モバイルナビゲーション
  if (elements.mobilePrevBtn && elements.mobileNextBtn) {
    if (currentPage <= 1) {
      elements.mobilePrevBtn.prop("disabled", true);
    } else {
      elements.mobilePrevBtn.prop("disabled", false);
    }

    if (currentPage >= CONFIG.TOTAL_PAGES) {
      elements.mobileNextBtn.prop("disabled", true);
    } else {
      elements.mobileNextBtn.prop("disabled", false);
    }

    if (elements.mobileFirstPageBtn && elements.mobileLastPageBtn) {
      if (currentPage <= firstContentPage) {
        elements.mobileFirstPageBtn.prop("disabled", true);
      } else {
        elements.mobileFirstPageBtn.prop("disabled", false);
      }

      if (currentPage >= lastContentPage) {
        elements.mobileLastPageBtn.prop("disabled", true);
      } else {
        elements.mobileLastPageBtn.prop("disabled", false);
      }
    }
  }
}

function updateSlider(page) {
  if (!state.isSliderDragging && elements.slider && elements.slider.hasClass("ui-slider")) {
    elements.slider.slider("value", page);
  }
}

/* ==========================================================================
   メモ機能
   ========================================================================== */
/**
 * メモパネルを開く
 */
function openNotesPanel() {
  if (state.notesOpen) return;

  elements.notesPanel.addClass("open");
  elements.notesToggleBtn.addClass("open");
  state.notesOpen = true;
}

/**
 * メモパネルを閉じる
 */
function closeNotesPanel() {
  if (!state.notesOpen) return;

  elements.notesPanel.removeClass("open");
  elements.notesToggleBtn.removeClass("open");
  state.notesOpen = false;
}

/**
 * メモパネルをトグル
 */
function toggleNotes() {
  if (state.notesOpen) {
    closeNotesPanel();
  } else {
    openNotesPanel();
  }
}

/**
 * メモを保存
 */
function saveNotes() {
  if (!elements.notesTextarea) return;

  const notes = elements.notesTextarea.val();
  localStorage.setItem(CONFIG.NOTES_STORAGE_KEY, notes);

  // 保存状態を表示
  if (elements.notesStatus) {
    elements.notesStatus.text("保存済み");
    elements.notesStatus.removeClass("saving");
  }
}

/**
 * メモを読み込み
 */
function loadNotes() {
  if (!elements.notesTextarea) return;

  const savedNotes = localStorage.getItem(CONFIG.NOTES_STORAGE_KEY);
  if (savedNotes) {
    elements.notesTextarea.val(savedNotes);
  }
}

/**
 * メモの自動保存（入力後一定時間後に保存）
 */
function scheduleNotesSave() {
  // 保存中表示
  if (elements.notesStatus) {
    elements.notesStatus.text("保存中...");
    elements.notesStatus.addClass("saving");
  }

  // 既存のタイマーをクリア
  if (state.notesSaveTimeout) {
    clearTimeout(state.notesSaveTimeout);
  }

  // 新しいタイマーをセット
  state.notesSaveTimeout = setTimeout(() => {
    saveNotes();
  }, CONFIG.NOTES_AUTOSAVE_DELAY);
}

/* ==========================================================================
   付箋機能
   ========================================================================== */
/**
 * 付箋データをlocalStorageから読み込み
 */
function loadStickyNotes() {
  try {
    const saved = localStorage.getItem(CONFIG.STICKY_STORAGE_KEY);
    if (saved) {
      state.stickyNotes = JSON.parse(saved);
      // カウンターを最大値+1にセット
      let maxId = 0;
      Object.values(state.stickyNotes).forEach((notes) => {
        notes.forEach((note) => {
          const num = parseInt(note.id.replace("sticky-", ""), 10);
          if (num > maxId) maxId = num;
        });
      });
      state.stickyCounter = maxId + 1;
    }
  } catch (error) {
    console.error("Failed to load sticky notes:", error);
    state.stickyNotes = {};
  }
}

/**
 * 付箋データをlocalStorageに保存
 */
function saveStickyNotes() {
  try {
    localStorage.setItem(CONFIG.STICKY_STORAGE_KEY, JSON.stringify(state.stickyNotes));
  } catch (error) {
    console.error("Failed to save sticky notes:", error);
  }
}

/**
 * 付箋追加モードのトグル
 */
function toggleStickyMode() {
  state.stickyModeEnabled = !state.stickyModeEnabled;

  if (state.stickyModeEnabled) {
    elements.stickyToggleBtn.addClass("active");
    $("#flipbook").addClass("sticky-mode");
  } else {
    elements.stickyToggleBtn.removeClass("active");
    $("#flipbook").removeClass("sticky-mode");
  }
}

/**
 * ページに付箋を追加
 */
function addStickyNote(pageNo, x, y, text = "", color = CONFIG.STICKY_DEFAULT_COLOR) {
  const id = `sticky-${state.stickyCounter++}`;

  const stickyData = {
    id,
    x,
    y,
    text,
    color,
  };

  // データに追加
  if (!state.stickyNotes[pageNo]) {
    state.stickyNotes[pageNo] = [];
  }
  state.stickyNotes[pageNo].push(stickyData);

  // DOM要素を作成
  createStickyElement(pageNo, stickyData);

  // 保存
  saveStickyNotes();

  return id;
}

/**
 * 付箋DOM要素を作成
 */
function createStickyElement(pageNo, stickyData) {
  const page = $(`.page[data-page="${pageNo}"]`);
  if (!page.length) return;

  const sticky = $("<div>", {
    class: "sticky-note",
    id: stickyData.id,
    "data-page": pageNo,
    css: {
      left: `${stickyData.x}px`,
      top: `${stickyData.y}px`,
      backgroundColor: stickyData.color,
    },
  });

  // ヘッダー（ドラッグハンドル + 削除ボタン）
  const header = $("<div>", { class: "sticky-header" });

  // ドラッグハンドル
  const dragHandle = $("<div>", {
    class: "sticky-drag-handle",
    html: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="9" cy="12" r="1"></circle>
      <circle cx="15" cy="12" r="1"></circle>
    </svg>`,
  });

  // カラーピッカー
  const colorPicker = $("<div>", { class: "sticky-color-picker" });
  CONFIG.STICKY_COLORS.forEach((color) => {
    const colorBtn = $("<button>", {
      class: "sticky-color-btn",
      css: { backgroundColor: color },
      "data-color": color,
    });
    if (color === stickyData.color) {
      colorBtn.addClass("active");
    }
    colorPicker.append(colorBtn);
  });

  // 削除ボタン
  const deleteBtn = $("<button>", {
    class: "sticky-delete-btn",
    html: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>`,
  });

  header.append(dragHandle, colorPicker, deleteBtn);

  // テキストエリア
  const textarea = $("<textarea>", {
    class: "sticky-textarea",
    placeholder: "メモを入力...",
    val: stickyData.text,
  });

  sticky.append(header, textarea);
  page.append(sticky);

  // イベントリスナー設定
  setupStickyEvents(sticky, pageNo, stickyData.id);
}

/**
 * 付箋のイベントリスナーを設定
 */
function setupStickyEvents(sticky, pageNo, stickyId) {
  const textarea = sticky.find(".sticky-textarea");
  const deleteBtn = sticky.find(".sticky-delete-btn");
  const colorBtns = sticky.find(".sticky-color-btn");
  const dragHandle = sticky.find(".sticky-drag-handle");

  // テキスト変更時の保存
  textarea.on("input", debounce(() => {
    updateStickyText(pageNo, stickyId, textarea.val());
  }, 500));

  // 削除ボタン
  deleteBtn.on("click", (e) => {
    e.stopPropagation();
    if (confirm("この付箋を削除しますか？")) {
      deleteStickyNote(pageNo, stickyId);
    }
  });

  // 色変更
  colorBtns.on("click", function (e) {
    e.stopPropagation();
    const color = $(this).data("color");
    colorBtns.removeClass("active");
    $(this).addClass("active");
    sticky.css("backgroundColor", color);
    updateStickyColor(pageNo, stickyId, color);
  });

  // ドラッグ機能
  let isDragging = false;
  let startX, startY, offsetX, offsetY;

  dragHandle.on("mousedown", function (e) {
    isDragging = true;
    startX = e.pageX;
    startY = e.pageY;
    const position = sticky.position();
    offsetX = position.left;
    offsetY = position.top;

    sticky.addClass("dragging");
    e.preventDefault();
  });

  $(document).on("mousemove", function (e) {
    if (!isDragging) return;

    const deltaX = e.pageX - startX;
    const deltaY = e.pageY - startY;
    const newX = offsetX + deltaX;
    const newY = offsetY + deltaY;

    sticky.css({
      left: `${newX}px`,
      top: `${newY}px`,
    });
  });

  $(document).on("mouseup", function (e) {
    if (!isDragging) return;

    isDragging = false;
    sticky.removeClass("dragging");

    const position = sticky.position();
    updateStickyPosition(pageNo, stickyId, position.left, position.top);
  });
}

/**
 * 付箋のテキストを更新
 */
function updateStickyText(pageNo, stickyId, text) {
  const notes = state.stickyNotes[pageNo];
  if (!notes) return;

  const note = notes.find((n) => n.id === stickyId);
  if (note) {
    note.text = text;
    saveStickyNotes();
  }
}

/**
 * 付箋の色を更新
 */
function updateStickyColor(pageNo, stickyId, color) {
  const notes = state.stickyNotes[pageNo];
  if (!notes) return;

  const note = notes.find((n) => n.id === stickyId);
  if (note) {
    note.color = color;
    saveStickyNotes();
  }
}

/**
 * 付箋の位置を更新
 */
function updateStickyPosition(pageNo, stickyId, x, y) {
  const notes = state.stickyNotes[pageNo];
  if (!notes) return;

  const note = notes.find((n) => n.id === stickyId);
  if (note) {
    note.x = x;
    note.y = y;
    saveStickyNotes();
  }
}

/**
 * 付箋を削除
 */
function deleteStickyNote(pageNo, stickyId) {
  const notes = state.stickyNotes[pageNo];
  if (!notes) return;

  const index = notes.findIndex((n) => n.id === stickyId);
  if (index !== -1) {
    notes.splice(index, 1);
    $(`#${stickyId}`).remove();
    saveStickyNotes();

    // 付箋一覧を更新
    updateStickyList();
  }
}

/**
 * 現在のページの付箋を表示
 */
function renderStickiesForPage(pageNo) {
  const notes = state.stickyNotes[pageNo];
  if (!notes || notes.length === 0) return;

  notes.forEach((stickyData) => {
    // 既に存在する場合はスキップ
    if ($(`#${stickyData.id}`).length > 0) return;
    createStickyElement(pageNo, stickyData);
  });
}

/**
 * ページクリックで付箋を追加（付箋モード時）
 */
function handlePageClickForSticky(e) {
  if (!state.stickyModeEnabled) return;

  const page = $(e.currentTarget);
  const pageNo = parseInt(page.data("page"), 10);

  // 画像ページのみ
  if (!isImageTurnPage(pageNo)) return;

  // ページ内の相対座標を取得
  const offset = page.offset();
  const x = e.pageX - offset.left;
  const y = e.pageY - offset.top;

  // 付箋を追加
  addStickyNote(pageNo, x, y);

  // モードを解除
  toggleStickyMode();

  // 付箋一覧を更新
  updateStickyList();
}

/* ==========================================================================
   ハンバーガーメニュー
   ========================================================================== */
/**
 * ハンバーガーメニューを開く
 */
function openHamburgerMenu() {
  if (state.hamburgerMenuOpen) return;

  elements.hamburgerMenu.addClass("open");
  elements.hamburgerOverlay.addClass("active");
  state.hamburgerMenuOpen = true;
}

/**
 * ハンバーガーメニューを閉じる
 */
function closeHamburgerMenu() {
  if (!state.hamburgerMenuOpen) return;

  elements.hamburgerMenu.removeClass("open");
  elements.hamburgerOverlay.removeClass("active");
  state.hamburgerMenuOpen = false;
}

/**
 * ハンバーガーメニューをトグル
 */
function toggleHamburgerMenu() {
  if (state.hamburgerMenuOpen) {
    closeHamburgerMenu();
  } else {
    openHamburgerMenu();
  }
}

/* ==========================================================================
   付箋一覧パネル
   ========================================================================== */
/**
 * 付箋一覧パネルを開く
 */
function openStickyListPanel() {
  if (state.stickyListOpen) return;

  elements.stickyListPanel.addClass("open");
  elements.stickyListToggleBtn.addClass("active");
  state.stickyListOpen = true;

  // 一覧を更新
  updateStickyList();
}

/**
 * 付箋一覧パネルを閉じる
 */
function closeStickyListPanel() {
  if (!state.stickyListOpen) return;

  elements.stickyListPanel.removeClass("open");
  elements.stickyListToggleBtn.removeClass("active");
  state.stickyListOpen = false;
}

/**
 * 付箋一覧パネルをトグル
 */
function toggleStickyListPanel() {
  if (state.stickyListOpen) {
    closeStickyListPanel();
  } else {
    openStickyListPanel();
  }
}

/**
 * 付箋一覧を更新
 */
function updateStickyList() {
  const container = elements.stickyListContainer;
  container.empty();

  // 全ての付箋を取得してソート
  const allStickies = [];
  Object.keys(state.stickyNotes).forEach((pageNo) => {
    const notes = state.stickyNotes[pageNo];
    notes.forEach((note) => {
      allStickies.push({
        pageNo: parseInt(pageNo, 10),
        ...note,
      });
    });
  });

  // ページ番号でソート
  allStickies.sort((a, b) => a.pageNo - b.pageNo);

  // 付箋がない場合
  if (allStickies.length === 0) {
    container.append(`
      <div class="sticky-list-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21 16V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z"></path>
        </svg>
        <p>付箋がありません</p>
        <small>左上の付箋ボタンから<br>カタログに付箋を追加できます</small>
      </div>
    `);
    return;
  }

  // 付箋アイテムを生成
  allStickies.forEach((sticky) => {
    const imgNo = turnPageToImageNo(sticky.pageNo);
    const pageLabel = imgNo ? `ページ ${imgNo}` : `ページ ${sticky.pageNo}`;
    const textPreview = sticky.text || "（空白）";
    const isEmpty = !sticky.text;

    const item = $("<div>", {
      class: "sticky-list-item",
      "data-page": sticky.pageNo,
      "data-sticky-id": sticky.id,
      css: {
        borderLeftColor: sticky.color,
      },
    });

    const header = $("<div>", { class: "sticky-list-item-header" });
    const pageLabelSpan = $("<span>", {
      class: "sticky-list-item-page",
      text: pageLabel,
    });

    const actions = $("<div>", { class: "sticky-list-item-actions" });
    const deleteBtn = $("<button>", {
      class: "sticky-list-item-delete",
      html: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>`,
    });

    actions.append(deleteBtn);
    header.append(pageLabelSpan, actions);

    const textDiv = $("<p>", {
      class: isEmpty ? "sticky-list-item-text empty" : "sticky-list-item-text",
      text: textPreview,
    });

    item.append(header, textDiv);
    container.append(item);

    // イベントリスナー
    item.on("click", function (e) {
      // 削除ボタンのクリックは除外
      if ($(e.target).closest(".sticky-list-item-delete").length > 0) {
        return;
      }
      handleStickyListItemClick(sticky.pageNo);
    });

    deleteBtn.on("click", function (e) {
      e.stopPropagation();
      if (confirm("この付箋を削除しますか？")) {
        deleteStickyNote(sticky.pageNo, sticky.id);
      }
    });
  });
}

/**
 * 付箋一覧アイテムクリック時のページジャンプ
 */
function handleStickyListItemClick(pageNo) {
  goToPage(pageNo);

  // モバイルではパネルを閉じる
  if (window.innerWidth <= 768) {
    closeStickyListPanel();
  }
}

/* ==========================================================================
   サイドバー制御
   ========================================================================== */
/**
 * サイドバーを開く
 */
function openSidebar() {
  if (state.sidebarOpen) return;

  elements.sidebar.addClass("open");

  // モバイルではオーバーレイを表示
  if (elements.sidebarOverlay && window.innerWidth <= 768) {
    elements.sidebarOverlay.addClass("active");
  }

  state.sidebarOpen = true;

  // 状態を保存
  localStorage.setItem(CONFIG.SIDEBAR_STORAGE_KEY, "open");

  // サムネイルが未生成なら生成
  if (!state.thumbnailsGenerated) {
    generateThumbnails();
  }

  // 現在のページをハイライト
  updateThumbnailHighlight(state.currentPage);

  // 現在のページにスクロール
  scrollToActiveThumbnail(state.currentPage);
}

/**
 * サイドバーを閉じる
 */
function closeSidebar() {
  if (!state.sidebarOpen) return;

  elements.sidebar.removeClass("open");

  if (elements.sidebarOverlay) {
    elements.sidebarOverlay.removeClass("active");
  }

  state.sidebarOpen = false;

  localStorage.setItem(CONFIG.SIDEBAR_STORAGE_KEY, "closed");
}

/**
 * サイドバーをトグル
 */
function toggleSidebar() {
  if (state.sidebarOpen) {
    closeSidebar();
  } else {
    openSidebar();
  }
}

/**
 * サイドバーの保存状態を復元
 */
function restoreSidebarState() {
  const savedState = localStorage.getItem(CONFIG.SIDEBAR_STORAGE_KEY);

  // デスクトップではデフォルトで開く、モバイルでは閉じる
  const shouldOpenByDefault = window.innerWidth > 768;

  if (savedState === "open" || (!savedState && shouldOpenByDefault)) {
    // 少し遅延させて開く（turn.js初期化後）
    setTimeout(() => {
      openSidebar();
    }, 200);
  }
}

/**
 * 現在のページに対応するサムネイルをハイライト（単独/見開き対応）
 */
function updateThumbnailHighlight(turnPage) {
  if (!state.thumbnailsGenerated) return;

  // すべてのアクティブクラスを削除
  $(".thumbnail-item").removeClass("active");

  // 現在のビュー（見開き）に含まれるページをハイライト
  const view = $("#flipbook").turn("view") || [];

  const firstPage = CONFIG.COVER_PAGES_FRONT + 1; // turn.jsページ3
  const lastPage = CONFIG.COVER_PAGES_FRONT + CONFIG.IMAGE_PAGES; // turn.jsページ6

  view.forEach((page) => {
    // 本文ページかどうか確認
    if (isImageTurnPage(page)) {
      // 最初のページ（単独）
      if (page === firstPage) {
        $(`.thumbnail-item[data-turn-page="${page}"]`).addClass("active");
      }
      // 最後のページ（単独）
      else if (page === lastPage) {
        $(`.thumbnail-item[data-turn-page="${page}"]`).addClass("active");
      }
      // 中間ページ（見開き）
      else {
        // 偶数ページなら左ページを計算
        const spreadLeftPage = page % 2 === 0 ? page - 1 : page;
        $(`.thumbnail-item[data-turn-page="${spreadLeftPage}"]`).addClass("active");
      }
    }
  });
}

/**
 * アクティブなサムネイルまでスクロール
 */
function scrollToActiveThumbnail(turnPage) {
  if (!state.thumbnailsGenerated || !state.sidebarOpen) return;

  const activeThumbnail = $(`.thumbnail-item[data-turn-page="${turnPage}"]`);

  if (activeThumbnail.length && elements.sidebar) {
    const container = elements.sidebar.find(".sidebar-content");
    const containerScrollTop = container.scrollTop();
    const containerHeight = container.height();
    const itemTop = activeThumbnail.position().top + containerScrollTop;
    const itemHeight = activeThumbnail.outerHeight();

    // アイテムが見える範囲外なら中央にスクロール
    const scrollTop = container.scrollTop();
    const viewportTop = scrollTop;
    const viewportBottom = scrollTop + containerHeight;
    const itemBottom = itemTop + itemHeight;

    if (itemTop < viewportTop || itemBottom > viewportBottom) {
      const scrollTo = itemTop - containerHeight / 2 + itemHeight / 2;
      container.animate({ scrollTop: scrollTo }, 300);
    }
  }
}

/**
 * サムネイルクリックでページジャンプ
 */
function handleThumbnailClick(turnPage) {
  goToPage(turnPage);

  // モバイルではサイドバーを自動的に閉じる
  if (window.innerWidth <= 768) {
    closeSidebar();
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
   動的サイズ計算
   ========================================================================== */
/**
 * 画面サイズに応じた最適なカタログサイズを計算
 */
function calculateBookSize() {
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;
  const isMobile = windowWidth <= 768;

  // ページのアスペクト比（A4サイズ: 210mm × 297mm）
  const pageAspectRatio = CONFIG.PAGE_WIDTH / CONFIG.PAGE_HEIGHT;

  let displayMode, bookWidth, bookHeight;

  if (isMobile) {
    // モバイル: 単ページ表示
    displayMode = "single";

    // 余白の設定（モバイル）
    const marginTop = 80;
    const marginBottom = 80;

    // 利用可能な領域（横幅100%）
    const availableWidth = windowWidth;
    const availableHeight = windowHeight - marginTop - marginBottom;

    // 幅または高さのどちらかに合わせる
    const widthBasedHeight = availableWidth / pageAspectRatio;

    if (widthBasedHeight <= availableHeight) {
      // 幅ベース（100%）
      bookWidth = availableWidth;
      bookHeight = bookWidth / pageAspectRatio;
    } else {
      // 高さベース
      bookHeight = availableHeight;
      bookWidth = bookHeight * pageAspectRatio;
    }
  } else {
    // デスクトップ/タブレット: 見開き表示
    displayMode = "double";

    // 余白の設定（デスクトップ）
    const marginTop = 40;
    const marginBottom = 40;

    // 利用可能な領域（横幅100%）
    const availableWidth = windowWidth;
    const availableHeight = windowHeight - marginTop - marginBottom;

    // 見開きのアスペクト比（2ページ分）
    const spreadAspectRatio = (CONFIG.PAGE_WIDTH * 2) / CONFIG.PAGE_HEIGHT;

    // 幅または高さのどちらかに合わせる
    const widthBasedHeight = availableWidth / spreadAspectRatio;

    if (widthBasedHeight <= availableHeight) {
      // 幅ベース（100%）
      bookWidth = availableWidth;
      bookHeight = bookWidth / spreadAspectRatio;
    } else {
      // 高さベース
      bookHeight = availableHeight;
      bookWidth = bookHeight * spreadAspectRatio;
    }

    // 最大サイズの制限（デスクトップ）
    // A4見開きの最大サイズ
    const maxWidth = CONFIG.PAGE_WIDTH * 2; // 1190px
    const maxHeight = CONFIG.PAGE_HEIGHT; // 842px

    if (bookWidth > maxWidth) {
      bookWidth = maxWidth;
      bookHeight = maxWidth / spreadAspectRatio;
    }
    if (bookHeight > maxHeight) {
      bookHeight = maxHeight;
      bookWidth = maxHeight * spreadAspectRatio;
    }
  }

  return {
    width: Math.floor(bookWidth),
    height: Math.floor(bookHeight),
    display: displayMode,
  };
}

/* ==========================================================================
   リサイズ対応
   ========================================================================== */
function handleResize() {
  if (!state.isInitialized) return;

  const flipbook = $("#flipbook");
  const size = calculateBookSize();

  // 表示モードを切り替え
  const currentDisplay = flipbook.turn("display");
  if (currentDisplay !== size.display) {
    flipbook.turn("display", size.display);
  }

  // サイズを調整
  flipbook.turn("size", size.width, size.height);
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

  // 左下固定ナビゲーションボタン
  elements.sidebarPrevBtn.on("click", function () {
    prevPage();
  });

  elements.sidebarNextBtn.on("click", function () {
    nextPage();
  });

  elements.sidebarFirstPageBtn.on("click", function () {
    goToFirstPage();
  });

  elements.sidebarLastPageBtn.on("click", function () {
    goToLastPage();
  });

  // ページジャンプボタン
  elements.pageJumpBtn.on("click", function () {
    handlePageJump();
  });

  // ページジャンプ入力でEnterキー
  elements.pageJumpInput.on("keypress", function (e) {
    if (e.key === "Enter") {
      handlePageJump();
    }
  });

  // ズームボタン
  elements.zoomInBtn.on("click", zoomIn);
  elements.zoomOutBtn.on("click", zoomOut);
  elements.zoomResetBtn.on("click", zoomReset);

  // マウスホイールでズーム
  elements.bookZoom.on("wheel", handleWheelZoom);

  // パン操作（ドラッグ）
  elements.bookZoom.on("mousedown", startPan);
  $(document).on("mousemove", doPan);
  $(document).on("mouseup", endPan);

  // タッチ操作対応
  elements.bookZoom.on("touchstart", startPan);
  $(document).on("touchmove", doPan);
  $(document).on("touchend", endPan);

  // サイドバートグルボタン
  elements.sidebarToggleBtn.on("click", toggleSidebar);

  // サイドバー閉じるボタン
  elements.sidebarCloseBtn.on("click", closeSidebar);

  // サムネイルクリック（委譲イベント）
  elements.thumbnailContainer.on("click", ".thumbnail-item", function () {
    const turnPage = parseInt($(this).data("turn-page"), 10);
    handleThumbnailClick(turnPage);
  });

  // オーバーレイクリックでサイドバーを閉じる
  if (elements.sidebarOverlay) {
    elements.sidebarOverlay.on("click", closeSidebar);
  }

  // メモパネルの開閉
  elements.notesToggleBtn.on("click", toggleNotes);

  // メモパネルの閉じるボタン
  elements.notesPanelCloseBtn.on("click", closeNotesPanel);

  // メモ入力時の自動保存
  elements.notesTextarea.on("input", function () {
    scheduleNotesSave();
  });

  // 付箋トグルボタン
  elements.stickyToggleBtn.on("click", toggleStickyMode);

  // 付箋一覧トグルボタン
  elements.stickyListToggleBtn.on("click", toggleStickyListPanel);

  // 付箋一覧パネルの閉じるボタン
  elements.stickyListPanelCloseBtn.on("click", closeStickyListPanel);

  // ページクリックで付箋追加
  $(document).on("click", ".page", handlePageClickForSticky);

  // ハンバーガーメニューの開閉
  elements.hamburgerMenuBtn.on("click", toggleHamburgerMenu);
  elements.hamburgerMenuCloseBtn.on("click", closeHamburgerMenu);
  elements.hamburgerOverlay.on("click", closeHamburgerMenu);

  // ハンバーガーメニュー内のページナビゲーション
  elements.hamburgerPrevBtn.on("click", function () {
    prevPage();
    closeHamburgerMenu();
  });

  elements.hamburgerNextBtn.on("click", function () {
    nextPage();
    closeHamburgerMenu();
  });

  elements.hamburgerFirstPageBtn.on("click", function () {
    goToFirstPage();
    closeHamburgerMenu();
  });

  elements.hamburgerLastPageBtn.on("click", function () {
    goToLastPage();
    closeHamburgerMenu();
  });

  // ハンバーガーメニュー内の機能ボタン
  elements.hamburgerSidebarBtn.on("click", function () {
    toggleSidebar();
    closeHamburgerMenu();
  });

  elements.hamburgerNotesBtn.on("click", function () {
    toggleNotes();
    closeHamburgerMenu();
  });

  elements.hamburgerStickyBtn.on("click", function () {
    toggleStickyMode();
    closeHamburgerMenu();
  });

  elements.hamburgerStickyListBtn.on("click", function () {
    toggleStickyListPanel();
    closeHamburgerMenu();
  });

  // モバイルナビゲーションボタン
  elements.mobilePrevBtn.on("click", function () {
    prevPage();
  });

  elements.mobileNextBtn.on("click", function () {
    nextPage();
  });

  elements.mobileFirstPageBtn.on("click", function () {
    goToFirstPage();
  });

  elements.mobileLastPageBtn.on("click", function () {
    goToLastPage();
  });

  elements.guideOverlay.on("click", function () {
    $(this).addClass("hidden");
    localStorage.setItem(CONFIG.GUIDE_STORAGE_KEY, "true");
  });

  $(window).on("resize", debounce(() => {
    handleResize();
    // デスクトップに戻ったらオーバーレイを非表示
    if (window.innerWidth > 768 && elements.sidebarOverlay) {
      elements.sidebarOverlay.removeClass("active");
    }
  }, CONFIG.DEBOUNCE_DELAY));
}

/* ==========================================================================
   初期化
   ========================================================================== */
function cacheElements() {
  elements.flipbook = $("#flipbook");
  elements.loadingOverlay = $("#loadingOverlay");
  elements.guideOverlay = $("#guideOverlay");
  elements.slider = $("#slider");
  elements.sidebar = $("#thumbnail-sidebar");
  elements.sidebarToggleBtn = $("#sidebar-toggle-btn");
  elements.sidebarCloseBtn = $("#sidebar-close-btn");
  elements.thumbnailContainer = $("#thumbnail-container");
  elements.sidebarOverlay = $("#sidebar-overlay");
  elements.notesToggleBtn = $("#notes-toggle-btn");
  elements.notesPanel = $("#notes-panel");
  elements.notesPanelCloseBtn = $("#notes-panel-close-btn");
  elements.notesTextarea = $("#catalog-notes");
  elements.notesStatus = $("#notes-status");
  elements.stickyToggleBtn = $("#sticky-toggle-btn");
  elements.stickyListToggleBtn = $("#sticky-list-toggle-btn");
  elements.stickyListPanel = $("#sticky-list-panel");
  elements.stickyListPanelCloseBtn = $("#sticky-list-panel-close-btn");
  elements.stickyListContainer = $("#sticky-list-container");
  elements.sidebarPageNumberSpan = $("#sidebar-page-number");
  elements.sidebarTotalPagesSpan = $("#sidebar-total-pages");
  elements.sidebarPrevBtn = $("#sidebar-prev-btn");
  elements.sidebarNextBtn = $("#sidebar-next-btn");
  elements.sidebarFirstPageBtn = $("#sidebar-first-page-btn");
  elements.sidebarLastPageBtn = $("#sidebar-last-page-btn");
  elements.pageJumpInput = $("#page-jump-input");
  elements.pageJumpBtn = $("#page-jump-btn");
  elements.zoomInBtn = $("#zoom-in-btn");
  elements.zoomOutBtn = $("#zoom-out-btn");
  elements.zoomResetBtn = $("#zoom-reset-btn");
  elements.bookZoom = $("#book-zoom");
  elements.hamburgerMenuBtn = $("#hamburger-menu-btn");
  elements.hamburgerMenu = $("#hamburger-menu");
  elements.hamburgerMenuCloseBtn = $("#hamburger-menu-close-btn");
  elements.hamburgerOverlay = $("#hamburger-overlay");
  elements.hamburgerPageNumberSpan = $("#hamburger-page-number");
  elements.hamburgerTotalPagesSpan = $("#hamburger-total-pages");
  elements.hamburgerPrevBtn = $("#hamburger-prev-btn");
  elements.hamburgerNextBtn = $("#hamburger-next-btn");
  elements.hamburgerFirstPageBtn = $("#hamburger-first-page-btn");
  elements.hamburgerLastPageBtn = $("#hamburger-last-page-btn");
  elements.hamburgerSidebarBtn = $("#hamburger-sidebar-btn");
  elements.hamburgerNotesBtn = $("#hamburger-notes-btn");
  elements.hamburgerStickyBtn = $("#hamburger-sticky-btn");
  elements.hamburgerStickyListBtn = $("#hamburger-sticky-list-btn");
  elements.mobilePageNumberSpan = $("#mobile-page-number");
  elements.mobileTotalPagesSpan = $("#mobile-total-pages");
  elements.mobilePrevBtn = $("#mobile-prev-btn");
  elements.mobileNextBtn = $("#mobile-next-btn");
  elements.mobileFirstPageBtn = $("#mobile-first-page-btn");
  elements.mobileLastPageBtn = $("#mobile-last-page-btn");
}

async function initialize() {
  try {
    if (typeof jQuery === "undefined") throw new Error("jQuery library not loaded");
    if (typeof $.fn.turn === "undefined") throw new Error("turn.js library not loaded");
    if (typeof $.fn.slider === "undefined") throw new Error("jQuery UI library not loaded");

    cacheElements();

    // 左下固定ナビゲーションの総ページ数表示
    if (elements.sidebarTotalPagesSpan) {
      elements.sidebarTotalPagesSpan.text(CONFIG.IMAGE_PAGES);
    }

    // ハンバーガーメニューの総ページ数表示
    if (elements.hamburgerTotalPagesSpan) {
      elements.hamburgerTotalPagesSpan.text(CONFIG.IMAGE_PAGES);
    }

    // モバイルナビゲーションの総ページ数表示
    if (elements.mobileTotalPagesSpan) {
      elements.mobileTotalPagesSpan.text(CONFIG.IMAGE_PAGES);
    }

    // ページジャンプ入力フィールドのmax属性を設定
    if (elements.pageJumpInput) {
      elements.pageJumpInput.attr("max", CONFIG.IMAGE_PAGES);
    }

    renderAllPages();
    initializeTurnJS();
    setupEventListeners();

    const initialPageFromURL = getPageFromURL();
    initializeSlider();

    // サイドバー状態復元
    restoreSidebarState();

    // メモを読み込み
    loadNotes();

    // 付箋を読み込み
    loadStickyNotes();

    // 初期表示：
    // - 表紙から開始したい → 1
    // - 本文（画像1-2）から開始したい → imageNoToTurnPage(1) = 3
    const initialPage = initialPageFromURL; // ここを 1 や 3 に固定してもOK

    setTimeout(() => {
      goToPage(initialPage);
      updatePageIndicator(initialPage);
      updateNavigationButtons();
      updateSlider(initialPage);
      // 初期ページの単ページ/見開きオフセットを適用
      updatePageViewOffset();

      // 初期ページの付箋を表示
      const view = $("#flipbook").turn("view") || [];
      view.forEach((p) => {
        renderStickiesForPage(p);
      });
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
