// ======================================================
// PROGRESS — HABIT & GOAL TRACKER
// Firebase Version
// ======================================================

import { auth, db } from "./firebase-config.js";

import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  login,
  signup,
  logout,
  forgotPassword,
  getProfile,
  saveProfile
} from "./auth.js";


// ======================================================
// DATA
// ======================================================

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

const DEFAULT_GOALS = [
  {
    id: "goal_1",
    name: "Deep Work",
    sub: "8 hour focused work",
    tag: "Work"
  },
  {
    id: "goal_2",
    name: "Read",
    sub: "20 minutes reading",
    tag: "Personal"
  },
  {
    id: "goal_3",
    name: "Exercise",
    sub: "1 hour movement",
    tag: "Health"
  },
  {
    id: "goal_4",
    name: "Journal",
    sub: "Daily reflection",
    tag: "Mind"
  }
];


// ======================================================
// STATE
// ======================================================

let goals = structuredClone(DEFAULT_GOALS);

let completions = {};

let diaries = [];

let currentYear = new Date().getFullYear();
let monthDetailReturnPage = "monthlyPage";
let selectedMonth = new Date().getMonth();

let currentUser = null;

let profileData = null;

let editingGoalId = null;

let editingDiaryId = null;


// ======================================================
// HELPERS
// ======================================================

function isLoggedIn() {
  return !!currentUser;
}


function todayKey(date = new Date()) {

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


function formatDate(date) {

  return date.toLocaleDateString(
    "en-US",
    {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric"
    }
  );
}


function shortDate(date) {

  return date.toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric"
    }
  );
}


function escapeHTML(value = "") {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function createId(prefix = "id") {

  if (crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;
}


// ======================================================
// FIRESTORE PATHS
// ======================================================

function userCollection(name) {

  return collection(
    db,
    "users",
    currentUser.uid,
    name
  );
}


function userDoc(collectionName, id) {

  return doc(
    db,
    "users",
    currentUser.uid,
    collectionName,
    id
  );
}


// ======================================================
// LOAD USER DATA
// ======================================================

async function loadUserData(user) {

  if (!user) return;

  currentUser = user;

  try {

    // -------------------------
    // GOALS
    // -------------------------

    const goalSnapshot = await getDocs(
      userCollection("goals")
    );

    goals = goalSnapshot.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));


    // If first login
    if (goals.length === 0) {

      goals = structuredClone(DEFAULT_GOALS);

      for (const goal of goals) {

        await setDoc(
          userDoc("goals", goal.id),
          {
            ...goal,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          }
        );
      }
    }


    // -------------------------
    // COMPLETIONS
    // -------------------------

    const completionSnapshot = await getDocs(
      userCollection("completions")
    );

    completions = {};

    completionSnapshot.forEach((item) => {

      const data = item.data();

      completions[item.id] =
        data.data || {};
    });


    // -------------------------
    // DIARIES
    // -------------------------

    const diarySnapshot = await getDocs(
      userCollection("diaries")
    );

    diaries = diarySnapshot.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));

    diaries.sort(
      (a, b) =>
        new Date(b.date || 0) -
        new Date(a.date || 0)
    );


    // -------------------------
    // PROFILE
    // -------------------------

    profileData = await getProfile(user);

    renderAll();

    renderProfilePage();

  } catch (error) {

    console.error(
      "Failed to load Firebase data:",
      error
    );

    alert(
      "Data load nahi ho paaya. Firebase configuration/check rules verify karo."
    );
  }
}


// ======================================================
// RESET LOGGED-OUT STATE
// ======================================================

function resetTemporaryData() {

  currentUser = null;

  profileData = null;

  goals = structuredClone(DEFAULT_GOALS);

  completions = {};

  diaries = [];

  renderAll();

  updateProfileButton();

}


// ======================================================
// DAILY
// ======================================================

function renderDaily() {

  const label =
    document.getElementById("todayLabel");

  const pill =
    document.getElementById("datePill");

  if (label) {
    label.textContent = formatDate(new Date());
  }

  if (pill) {
    pill.textContent = shortDate(new Date());
  }


  const today = todayKey();

  const todayCompletion =
    completions[today] || {};


  const completed =
    goals.filter(
      goal => todayCompletion[goal.id]
    ).length;


  const total = goals.length;

  const percent =
    total === 0
      ? 0
      : Math.round(
          (completed / total) * 100
        );


  const dailyPercent =
    document.getElementById(
      "dailyPercent"
    );

  const dailyBar =
    document.getElementById("dailyBar");

  const completedCount =
    document.getElementById(
      "completedCount"
    );

  const remainingCount =
    document.getElementById(
      "remainingCount"
    );


  if (dailyPercent)
    dailyPercent.textContent =
      `${percent}%`;

  if (dailyBar)
    dailyBar.style.width =
      `${percent}%`;

  if (completedCount)
    completedCount.textContent =
      `${completed} completed`;

  if (remainingCount)
    remainingCount.textContent =
      `${total - completed} remaining`;


  const list =
    document.getElementById("goalList");

  if (!list) return;


  if (goals.length === 0) {

    list.innerHTML = `
      <div class="empty-state">
        No goals yet. Add your first goal.
      </div>
    `;

    return;
  }


  list.innerHTML = goals.map(goal => {

    const done =
      !!todayCompletion[goal.id];

    return `
      <div class="goal-item ${done ? "completed" : ""}">

        <label class="goal-check">

          <input
            type="checkbox"
            ${done ? "checked" : ""}
            onchange="toggleGoal('${goal.id}')"
          />

          <span class="checkmark"></span>

        </label>

        <div class="goal-info">

          <strong>
            ${escapeHTML(goal.name)}
          </strong>

          <span>
            ${escapeHTML(goal.sub || "")}
          </span>

        </div>

        ${
          goal.tag
            ? `<span class="goal-tag">
                ${escapeHTML(goal.tag)}
              </span>`
            : ""
        }

      </div>
    `;

  }).join("");


  updateStreak();

  updateMonthlyAverage();
}


// ======================================================
// TOGGLE GOAL
// ======================================================

window.toggleGoal = async function(goalId) {

  const today = todayKey();

  if (!completions[today]) {
    completions[today] = {};
  }

  completions[today][goalId] =
    !completions[today][goalId];


  renderDaily();


  if (!isLoggedIn()) {

    showLoginNotice();

    return;
  }


  try {

    await setDoc(
      userDoc("completions", today),
      {
        data: completions[today],
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

  } catch (error) {

    console.error(error);

    alert(
      "Progress save nahi ho paaya."
    );
  }
};


// ======================================================
// STREAK
// ======================================================

function calculateStreak() {

  let streak = 0;

  const date = new Date();

  while (true) {

    const key = todayKey(date);

    const data =
      completions[key] || {};

    const total = goals.length;

    const completed =
      goals.filter(
        goal => data[goal.id]
      ).length;


    if (
      total === 0 ||
      completed < total
    ) {
      break;
    }


    streak++;

    date.setDate(
      date.getDate() - 1
    );
  }

  return streak;
}


function updateStreak() {

  const element =
    document.getElementById(
      "streakCount"
    );

  if (element) {
    element.textContent =
      calculateStreak();
  }
}


// ======================================================
// MONTHLY AVERAGE
// ======================================================

function getMonthAverage(
  year,
  month
) {

  const daysInMonth =
    new Date(
      year,
      month + 1,
      0
    ).getDate();

  let totalPercent = 0;

  let countedDays = 0;


  for (
    let day = 1;
    day <= daysInMonth;
    day++
  ) {

    const date =
      new Date(
        year,
        month,
        day
      );

    if (
      date > new Date()
    ) {
      continue;
    }


    const key = todayKey(date);

    const data =
      completions[key] || {};


    if (goals.length > 0) {

      const completed =
        goals.filter(
          goal => data[goal.id]
        ).length;

      totalPercent +=
        (completed / goals.length) *
        100;

      countedDays++;
    }
  }


  if (!countedDays) return 0;

  return Math.round(
    totalPercent / countedDays
  );
}


function updateMonthlyAverage() {

  const average =
    getMonthAverage(
      new Date().getFullYear(),
      new Date().getMonth()
    );


  const element =
    document.getElementById(
      "monthAverage"
    );

  if (element) {
    element.textContent =
      `${average}%`;
  }


  const monthName =
    document.getElementById(
      "monthNameStat"
    );

  if (monthName) {

    monthName.textContent =
      MONTHS[
        new Date().getMonth()
      ];
  }
}


// ======================================================
// MONTHLY OVERVIEW
// ======================================================

function renderMonthly() {
  const grid = document.getElementById("monthGrid");
  const yearLabel = document.getElementById("yearLabel");

  if (!grid) return;

  if (yearLabel) {
    yearLabel.textContent = currentYear;
  }

  grid.innerHTML = MONTHS.map((month, index) => {
    const average = getMonthAverage(currentYear, index);

    return `
      <button
        type="button"
        class="month-card"
        data-month="${index}"
      >
        <div class="month-cover">
          <strong>${month}</strong>
          <span>${average}%</span>
        </div>

        <div class="month-card-content">
          <div class="progress-track">
            <div
              class="progress-fill"
              style="width:${average}%"
            ></div>
          </div>

          <small>View monthly details →</small>
        </div>
      </button>
    `;
  }).join("");

  /* CLICK EVENT */
grid.querySelectorAll(".month-card").forEach(card => {
  card.addEventListener("click", () => {
    selectedMonth = Number(card.dataset.month);

    monthDetailReturnPage = "monthlyPage";

    showPage("monthDetailPage");
    renderMonthDetail();
  });
});
}

// ======================================================
// MONTH DETAIL
// ======================================================

function renderMonthDetail() {

  const title = document.getElementById("detailMonthTitle");
  const sub = document.getElementById("detailMonthSub");
  const percent = document.getElementById("detailPercent");
  const bar = document.getElementById("detailBar");
  const info = document.getElementById("detailDaysInfo");
  const tbody = document.getElementById("detailTableBody");

  if (!tbody) return;

  const monthName = MONTHS[selectedMonth];

  const days = new Date(
    currentYear,
    selectedMonth + 1,
    0
  ).getDate();

  const average = getMonthAverage(
    currentYear,
    selectedMonth
  );


  /* =========================
     HEADER
  ========================= */

  if (title) {
    title.textContent = monthName;
  }

  if (sub) {
    sub.textContent =
      `${currentYear} · ${days} days`;
  }

  if (percent) {
    percent.textContent = `${average}%`;
  }

  if (bar) {
    bar.style.width = `${average}%`;
  }

  if (info) {
    info.textContent = `${days} days`;
  }


  /* =========================
     DYNAMIC TABLE HEAD
  ========================= */

  const table = tbody.closest("table");

  if (!table) return;

  const thead = table.querySelector("thead");

  if (thead) {

    thead.innerHTML = `
      <tr>

        <th class="date-column">
          <span>▣</span>
          Date
        </th>

        <th class="progress-column">
          <span>◯</span>
          Progress Bar
        </th>

        ${goals.map(goal => `
          <th class="goal-column">
            <span>□</span>
            ${escapeHTML(goal.name)}
          </th>
        `).join("")}

        <th class="notes-column">
          <span>▤</span>
          Notes
        </th>

        <th class="month-column">
          <span>▣</span>
          Month
        </th>

      </tr>
    `;
  }


  /* =========================
     TABLE ROWS
  ========================= */

  tbody.innerHTML = "";

  for (let day = 1; day <= days; day++) {

    const date = new Date(
      currentYear,
      selectedMonth,
      day
    );

    const key = todayKey(date);

    const data =
      completions[key] || {};


    const completed =
      goals.filter(
        goal => data[goal.id]
      ).length;


    const progress =
      goals.length
        ? Math.round(
            (completed / goals.length) * 100
          )
        : 0;


    /* =========================
       GOAL CHECKBOXES
    ========================= */

    const goalCells = goals.map(goal => {

      const checked =
        !!data[goal.id];

      return `
        <td class="goal-cell">

          <span
            class="notion-checkbox ${
              checked ? "checked" : ""
            }"
          >
            ${checked ? "✓" : ""}
          </span>

        </td>
      `;

    }).join("");


    /* =========================
       DIARY / NOTES
    ========================= */

    const diary =
      diaries.find(
        item =>
          item.date &&
          item.date.startsWith(key)
      );


    const noteText =
      diary
        ? (
            diary.title ||
            diary.content ||
            ""
          )
        : "";


    /* =========================
       ROW
    ========================= */

    tbody.innerHTML += `

      <tr>

        <td class="date-cell">
          ${date.toLocaleDateString(
            "en-US",
            {
              month: "long",
              day: "numeric",
              year: "numeric"
            }
          )}
        </td>


        <td class="progress-cell">

          <div class="notion-progress">

            <div class="notion-progress-track">

              <div
                class="notion-progress-fill"
                style="width:${progress}%"
              ></div>

            </div>

            <span>
              ${progress}%
            </span>

          </div>

        </td>


        ${goalCells}


        <td class="notes-cell">
          ${
            noteText
              ? escapeHTML(
                  noteText.slice(0, 45)
                )
              : ""
          }
        </td>


        <td class="month-cell">

          <span>▣</span>

          ${monthName}

        </td>

      </tr>

    `;
  }
}


// ======================================================
// GOALS MANAGEMENT
// ======================================================

function renderManageGoals() {

  const list =
    document.getElementById(
      "manageGoalList"
    );

  if (!list) return;


  if (!goals.length) {

    list.innerHTML = `
      <div class="empty-state">
        No goals created yet.
      </div>
    `;

    return;
  }


  list.innerHTML =
    goals.map(goal => `

      <div class="manage-goal-card">

        <div>

          <strong>
            ${escapeHTML(goal.name)}
          </strong>

          <p>
            ${escapeHTML(goal.sub || "")}
          </p>

          ${
            goal.tag
              ? `<span class="goal-tag">
                  ${escapeHTML(goal.tag)}
                </span>`
              : ""
          }

        </div>

        <div class="manage-actions">

          <button
            class="secondary-btn"
            onclick="editGoal('${goal.id}')"
          >
            Edit
          </button>

          <button
            class="danger-btn"
            onclick="deleteGoal('${goal.id}')"
          >
            Delete
          </button>

        </div>

      </div>

    `).join("");
}


// ======================================================
// ADD GOAL
// ======================================================

async function addGoal() {

  const name =
    document.getElementById(
      "goalName"
    )?.value.trim();

  const sub =
    document.getElementById(
      "goalSub"
    )?.value.trim();

  const tag =
    document.getElementById(
      "goalTag"
    )?.value.trim();


  if (!name) {

    alert("Please enter goal name.");

    return;
  }


  const goal = {

    id: createId("goal"),

    name,

    sub,

    tag
  };


  goals.push(goal);

  closeModal();

  renderAll();


  if (isLoggedIn()) {

    await setDoc(
      userDoc("goals", goal.id),
      {
        ...goal,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }
    );
  }
}


// ======================================================
// EDIT GOAL
// ======================================================

window.editGoal = function(goalId) {

  const goal =
    goals.find(
      item => item.id === goalId
    );

  if (!goal) return;


  editingGoalId = goalId;


  openModal(`
  
    <div class="modal-heading">
      <p class="eyebrow">EDIT GOAL</p>
      <h2>Edit Goal</h2>
    </div>

    <div class="form-group">

      <label>Goal Name</label>

      <input
        id="goalName"
        value="${escapeHTML(goal.name)}"
      />

    </div>

    <div class="form-group">

      <label>Description</label>

      <input
        id="goalSub"
        value="${escapeHTML(goal.sub || "")}"
      />

    </div>

    <div class="form-group">

      <label>Category</label>

      <input
        id="goalTag"
        value="${escapeHTML(goal.tag || "")}"
      />

    </div>

    <button
      class="primary-btn full"
      id="saveGoalEdit"
    >
      Save Goal
    </button>

  `);


  document.getElementById(
    "saveGoalEdit"
  ).onclick = saveGoalEdit;
};


async function saveGoalEdit() {

  const goal =
    goals.find(
      item =>
        item.id === editingGoalId
    );

  if (!goal) return;


  goal.name =
    document.getElementById(
      "goalName"
    ).value.trim();

  goal.sub =
    document.getElementById(
      "goalSub"
    ).value.trim();

  goal.tag =
    document.getElementById(
      "goalTag"
    ).value.trim();


  closeModal();

  renderAll();


  if (isLoggedIn()) {

    await setDoc(
      userDoc(
        "goals",
        goal.id
      ),
      {
        ...goal,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  }


  editingGoalId = null;
}


// ======================================================
// DELETE GOAL
// ======================================================

window.deleteGoal = async function(goalId) {

  const goal =
    goals.find(
      item => item.id === goalId
    );

  if (!goal) return;


  const confirmed =
    confirm(
      `Delete "${goal.name}"?`
    );

  if (!confirmed) return;


  goals =
    goals.filter(
      item => item.id !== goalId
    );


  Object.keys(
    completions
  ).forEach(date => {

    if (completions[date]) {

      delete completions[
        date
      ][goalId];
    }

  });


  renderAll();


  if (!isLoggedIn()) return;


  try {

    await deleteDoc(
      userDoc(
        "goals",
        goalId
      )
    );


    // Update completion records
    for (
      const date of Object.keys(
        completions
      )
    ) {

      await setDoc(
        userDoc(
          "completions",
          date
        ),
        {
          data:
            completions[date],
          updatedAt:
            serverTimestamp()
        },
        { merge: true }
      );
    }

  } catch (error) {

    console.error(error);

  }
};


// ======================================================
// DIARIES
// ======================================================

function renderDiaries() {

  const list =
    document.getElementById(
      "diaryList"
    );

  if (!list) return;


  if (!diaries.length) {

    list.innerHTML = `
      <div class="empty-state">
        No diary entries yet.
      </div>
    `;

    return;
  }


  list.innerHTML =
    diaries.map(diary => `

      <article class="diary-card">

        <div class="diary-card-top">

          <div>

            <strong>
              ${escapeHTML(
                diary.title ||
                "Untitled"
              )}
            </strong>

            <small>
              ${diary.date
                ? new Date(
                    diary.date
                  ).toLocaleDateString(
                    "en-US",
                    {
                      month: "short",
                      day: "numeric",
                      year: "numeric"
                    }
                  )
                : ""}
            </small>

          </div>

          <div class="manage-actions">

            <button
              class="secondary-btn"
              onclick="editDiary('${diary.id}')"
            >
              Edit
            </button>

            <button
              class="danger-btn"
              onclick="deleteDiary('${diary.id}')"
            >
              Delete
            </button>

          </div>

        </div>

        <p>
          ${escapeHTML(
            diary.content || ""
          )}
        </p>

      </article>

    `).join("");
}


// ======================================================
// ADD DIARY
// ======================================================

async function addDiary() {

  const title =
    document.getElementById(
      "diaryTitle"
    )?.value.trim();

  const content =
    document.getElementById(
      "diaryContent"
    )?.value.trim();


  if (!content) {

    alert(
      "Please write something."
    );

    return;
  }


  const diary = {

    id: createId("diary"),

    title,

    content,

    date: new Date().toISOString()

  };


  diaries.unshift(diary);

  closeModal();

  renderAll();


  if (isLoggedIn()) {

    await setDoc(
      userDoc(
        "diaries",
        diary.id
      ),
      {
        ...diary,
        createdAt:
          serverTimestamp(),
        updatedAt:
          serverTimestamp()
      }
    );
  }
}


// ======================================================
// EDIT DIARY
// ======================================================

window.editDiary = function(diaryId) {

  const diary =
    diaries.find(
      item =>
        item.id === diaryId
    );

  if (!diary) return;


  editingDiaryId = diaryId;


  openModal(`

    <div class="modal-heading">
      <p class="eyebrow">
        EDIT DIARY
      </p>

      <h2>
        Edit Diary
      </h2>
    </div>

    <div class="form-group">

      <label>
        Title
      </label>

      <input
        id="diaryTitle"
        value="${escapeHTML(
          diary.title || ""
        )}"
      />

    </div>

    <div class="form-group">

      <label>
        Reflection
      </label>

      <textarea
        id="diaryContent"
        rows="7"
      >${escapeHTML(
        diary.content || ""
      )}</textarea>

    </div>

    <button
      class="primary-btn full"
      id="saveDiaryEdit"
    >
      Save Diary
    </button>

  `);


  document.getElementById(
    "saveDiaryEdit"
  ).onclick =
    saveDiaryEdit;
};


async function saveDiaryEdit() {

  const diary =
    diaries.find(
      item =>
        item.id === editingDiaryId
    );

  if (!diary) return;


  diary.title =
    document.getElementById(
      "diaryTitle"
    ).value.trim();

  diary.content =
    document.getElementById(
      "diaryContent"
    ).value.trim();


  diary.updatedAt =
    new Date().toISOString();


  closeModal();

  renderAll();


  if (isLoggedIn()) {

    await setDoc(
      userDoc(
        "diaries",
        diary.id
      ),
      {
        ...diary,
        updatedAt:
          serverTimestamp()
      },
      { merge: true }
    );
  }


  editingDiaryId = null;
}


// ======================================================
// DELETE DIARY
// ======================================================

window.deleteDiary = async function(
  diaryId
) {

  const confirmed =
    confirm(
      "Delete this diary entry?"
    );

  if (!confirmed) return;


  diaries =
    diaries.filter(
      item =>
        item.id !== diaryId
    );


  renderDiaries();


  if (isLoggedIn()) {

    await deleteDoc(
      userDoc(
        "diaries",
        diaryId
      )
    );
  }
};


// ======================================================
// MODAL
// ======================================================

function openModal(content) {

  const modal =
    document.getElementById(
      "modal"
    );

  const modalContent =
    document.getElementById(
      "modalContent"
    );

  if (!modal || !modalContent)
    return;


  modalContent.innerHTML =
    content;

  modal.classList.remove(
    "hidden"
  );
}


function closeModal() {

  const modal =
    document.getElementById(
      "modal"
    );

  if (modal) {
    modal.classList.add(
      "hidden"
    );
  }
}


window.closeModal =
  closeModal;


// ======================================================
// ADD GOAL MODAL
// ======================================================

function openAddGoalModal() {

  openModal(`

    <div class="modal-heading">

      <p class="eyebrow">
        NEW GOAL
      </p>

      <h2>
        Add Goal
      </h2>

    </div>

    <div class="form-group">

      <label>
        Goal Name
      </label>

      <input
        id="goalName"
        placeholder="e.g. Workout"
      />

    </div>

    <div class="form-group">

      <label>
        Description
      </label>

      <input
        id="goalSub"
        placeholder="e.g. 1 hour exercise"
      />

    </div>

    <div class="form-group">

      <label>
        Category
      </label>

      <input
        id="goalTag"
        placeholder="Health"
      />

    </div>

    <button
      class="primary-btn full"
      id="saveGoalBtn"
    >
      Add Goal
    </button>

  `);


  document.getElementById(
    "saveGoalBtn"
  ).onclick =
    addGoal;
}


// ======================================================
// ADD DIARY MODAL
// ======================================================

function openAddDiaryModal() {

  openModal(`

    <div class="modal-heading">

      <p class="eyebrow">
        REFLECTION
      </p>

      <h2>
        New Diary
      </h2>

    </div>

    <div class="form-group">

      <label>
        Title
      </label>

      <input
        id="diaryTitle"
        placeholder="Today's thoughts"
      />

    </div>

    <div class="form-group">

      <label>
        Reflection
      </label>

      <textarea
        id="diaryContent"
        rows="8"
        placeholder="Write your thoughts..."
      ></textarea>

    </div>

    <button
      class="primary-btn full"
      id="saveDiaryBtn"
    >
      Save Diary
    </button>

  `);


  document.getElementById(
    "saveDiaryBtn"
  ).onclick =
    addDiary;
}


// ======================================================
// AUTH MODAL
// ======================================================

function openAuthModal(
  mode = "login"
) {

  const isSignup =
    mode === "signup";


  openModal(`

    <div class="auth-box">

      <p class="eyebrow">
        ${isSignup
          ? "CREATE ACCOUNT"
          : "WELCOME BACK"}
      </p>

      <h2>
        ${
          isSignup
            ? "Create your account"
            : "Login to Progress"
        }
      </h2>

      <p class="muted">
        ${
          isSignup
            ? "Save your goals and progress securely."
            : "Continue tracking your progress."
        }
      </p>


      ${
        isSignup
          ? `

            <div class="form-group">

              <label>
                Name
              </label>

              <input
                id="authName"
                placeholder="Your name"
              />

            </div>


            <div class="form-group">

              <label>
                Gender
              </label>

              <select id="authGender">

                <option value="">
                  Select gender
                </option>

                <option value="Male">
                  Male
                </option>

                <option value="Female">
                  Female
                </option>

                <option value="Other">
                  Other
                </option>

              </select>

            </div>


            <div class="form-group">

              <label>
                Mobile Number
              </label>

              <input
                id="authMobile"
                type="tel"
                placeholder="Mobile number"
              />

            </div>

          `
          : ""
      }


      <div class="form-group">

        <label>
          Email
        </label>

        <input
          id="authEmail"
          type="email"
          placeholder="you@example.com"
        />

      </div>


      <div class="form-group">

        <label>
          Password
        </label>

        <input
          id="authPassword"
          type="password"
          placeholder="Password"
        />

      </div>


      ${
        isSignup
          ? `

            <div class="form-group">

              <label>
                Confirm Password
              </label>

              <input
                id="authConfirmPassword"
                type="password"
                placeholder="Confirm password"
              />

            </div>

          `
          : ""
      }


      <div
        id="authError"
        class="auth-error"
      ></div>


      <button
        class="primary-btn full"
        id="authSubmit"
      >
        ${
          isSignup
            ? "Create Account"
            : "Login"
        }
      </button>


      ${
        !isSignup
          ? `

            <button
              class="text-btn"
              id="forgotPasswordBtn"
            >
              Forgot Password?
            </button>

          `
          : ""
      }


      <p class="auth-switch">

        ${
          isSignup
            ? "Already have an account?"
            : "Don't have an account?"
        }

        <button
          class="text-btn"
          id="switchAuth"
        >
          ${
            isSignup
              ? "Login"
              : "Sign Up"
          }
        </button>

      </p>

    </div>

  `);


  document.getElementById(
    "authSubmit"
  ).onclick = async () => {

    const errorBox =
      document.getElementById(
        "authError"
      );


    try {

      errorBox.textContent = "";


      const email =
        document.getElementById(
          "authEmail"
        ).value.trim();

      const password =
        document.getElementById(
          "authPassword"
        ).value;


      if (!email || !password) {

        throw new Error(
          "Email and password are required."
        );
      }


      if (isSignup) {

        const confirmPassword =
          document.getElementById(
            "authConfirmPassword"
          ).value;


        if (
          password !==
          confirmPassword
        ) {

          throw new Error(
            "Passwords do not match."
          );
        }


        await signup({

          name:
            document.getElementById(
              "authName"
            ).value.trim(),

          gender:
            document.getElementById(
              "authGender"
            ).value,

          mobile:
            document.getElementById(
              "authMobile"
            ).value.trim(),

          email,

          password

        });

      } else {

        await login(
          email,
          password
        );
      }


      closeModal();


    } catch (error) {

      console.error(error);

      errorBox.textContent =
        firebaseErrorMessage(
          error
        );
    }

  };


  const switchBtn =
    document.getElementById(
      "switchAuth"
    );

  if (switchBtn) {

    switchBtn.onclick = () => {

      openAuthModal(
        isSignup
          ? "login"
          : "signup"
      );
    };
  }


  const forgotBtn =
    document.getElementById(
      "forgotPasswordBtn"
    );

  if (forgotBtn) {

    forgotBtn.onclick =
      async () => {

        const email =
          document.getElementById(
            "authEmail"
          ).value.trim();


        try {

          await forgotPassword(
            email
          );

          alert(
            "Password reset email sent."
          );

        } catch (error) {

          document.getElementById(
            "authError"
          ).textContent =
            firebaseErrorMessage(
              error
            );
        }

      };
  }
}


// ======================================================
// FIREBASE ERROR MESSAGE
// ======================================================

function firebaseErrorMessage(
  error
) {

  const code =
    error?.code || "";


  const messages = {

    "auth/invalid-email":
      "Invalid email address.",

    "auth/user-not-found":
      "No account found with this email.",

    "auth/wrong-password":
      "Incorrect password.",

    "auth/invalid-credential":
      "Email or password is incorrect.",

    "auth/email-already-in-use":
      "This email is already registered.",

    "auth/weak-password":
      "Password should be at least 6 characters.",

    "auth/too-many-requests":
      "Too many attempts. Try again later.",

    "auth/network-request-failed":
      "Network error. Check your internet connection."

  };


  return (
    messages[code] ||
    error?.message ||
    "Something went wrong."
  );
}


// ======================================================
// PROFILE PAGE
// ======================================================

async function renderProfilePage() {

  const page =
    document.getElementById(
      "profilePage"
    );

  if (!page) return;


  if (!isLoggedIn()) {

    page.innerHTML = `

      <div class="profile-panel">

        <p class="eyebrow">
          ACCOUNT
        </p>

        <h1>
          Login to Progress
        </h1>

        <p class="muted">
          Login or create an account to
          permanently save your goals,
          progress and diaries.
        </p>

        <button
          class="primary-btn"
          id="profileLoginBtn"
        >
          Login / Sign Up
        </button>

      </div>

    `;


    document.getElementById(
      "profileLoginBtn"
    ).onclick = () =>
      openAuthModal("login");


    return;
  }


  if (!profileData) {

    profileData =
      await getProfile(
        currentUser
      );
  }


  const name =
    profileData?.name || "";

  const gender =
    profileData?.gender || "";

  const mobile =
    profileData?.mobile || "";

  const email =
    currentUser.email || "";


  page.innerHTML = `

    <div class="profile-panel">

      <p class="eyebrow">
        ACCOUNT
      </p>

      <h1>
        Your Profile
      </h1>

      <p class="muted">
        Manage your personal information.
      </p>


      <div class="profile-form">

        <div class="form-group">

          <label>
            Name
          </label>

          <input
            id="profileName"
            value="${escapeHTML(name)}"
            disabled
          />

        </div>


        <div class="form-group">

          <label>
            Email
          </label>

          <input
            value="${escapeHTML(email)}"
            disabled
          />

        </div>


        <div class="form-group">

          <label>
            Gender
          </label>

          <select
            id="profileGender"
            disabled
          >

            <option value="">
              Select gender
            </option>

            <option
              value="Male"
              ${gender === "Male"
                ? "selected"
                : ""}
            >
              Male
            </option>

            <option
              value="Female"
              ${gender === "Female"
                ? "selected"
                : ""}
            >
              Female
            </option>

            <option
              value="Other"
              ${gender === "Other"
                ? "selected"
                : ""}
            >
              Other
            </option>

          </select>

        </div>


        <div class="form-group">

          <label>
            Mobile Number
          </label>

          <input
            id="profileMobile"
            type="tel"
            value="${escapeHTML(mobile)}"
            disabled
          />

        </div>


        <div class="profile-buttons">

          <button
            class="secondary-btn"
            id="editProfileBtn"
          >
            Edit
          </button>

          <button
            class="primary-btn"
            id="saveProfileBtn"
            style="display:none"
          >
            Save
          </button>

          <button
            class="danger-btn"
            id="logoutBtn"
          >
            Log Out
          </button>

        </div>

      </div>

    </div>

  `;


  // EDIT

  document.getElementById(
    "editProfileBtn"
  ).onclick = () => {

    document.getElementById(
      "profileName"
    ).disabled = false;

    document.getElementById(
      "profileGender"
    ).disabled = false;

    document.getElementById(
      "profileMobile"
    ).disabled = false;


    document.getElementById(
      "editProfileBtn"
    ).style.display =
      "none";

    document.getElementById(
      "saveProfileBtn"
    ).style.display =
      "inline-flex";
  };


  // SAVE

  document.getElementById(
    "saveProfileBtn"
  ).onclick = async () => {

    try {

      const data = {

        name:
          document.getElementById(
            "profileName"
          ).value.trim(),

        gender:
          document.getElementById(
            "profileGender"
          ).value,

        mobile:
          document.getElementById(
            "profileMobile"
          ).value.trim()

      };


      await saveProfile(
        currentUser,
        data
      );


      profileData = {
        ...profileData,
        ...data
      };


      alert(
        "Profile saved successfully."
      );


      renderProfilePage();


      updateProfileButton();


    } catch (error) {

      console.error(error);

      alert(
        "Profile save nahi ho paaya."
      );
    }
  };


  // LOGOUT

  document.getElementById(
    "logoutBtn"
  ).onclick = async () => {

    const confirmLogout =
      confirm(
        "Are you sure you want to logout?"
      );

    if (!confirmLogout)
      return;


    await logout();
  };
}


// ======================================================
// PROFILE TOP BUTTON
// ======================================================

function updateProfileButton() {

  const button =
    document.getElementById(
      "profileBtn"
    );

  if (!button) return;


  if (!currentUser) {

    button.textContent = "A";

    return;
  }


  const name =
    profileData?.name ||
    currentUser.email ||
    "U";


  button.textContent =
    name
      .charAt(0)
      .toUpperCase();
}


// ======================================================
// LOGIN NOTICE
// ======================================================

function showLoginNotice() {

  if (isLoggedIn()) return;


  const shouldLogin =
    confirm(
      "Login karke apna progress permanently save karo.\n\nLogin now?"
    );


  if (shouldLogin) {

    openAuthModal(
      "login"
    );
  }
}


// ======================================================
// PAGE NAVIGATION
// ======================================================

function showPage(pageId) {

  document
    .querySelectorAll(".page")
    .forEach(page => {

      page.classList.remove(
        "active"
      );
    });


  const page =
    document.getElementById(
      pageId
    );


  if (page) {

    page.classList.add(
      "active"
    );
  }


  document
    .querySelectorAll(
      ".nav-item"
    )
    .forEach(item => {

      item.classList.toggle(
        "active",
        item.dataset.page ===
          pageId
      );
    });


  if (
    pageId ===
    "monthlyPage"
  ) {

    renderMonthly();
  }


  if (
    pageId ===
    "monthDetailPage"
  ) {

    renderMonthDetail();
  }


  if (
    pageId ===
    "goalsPage"
  ) {

    renderManageGoals();
  }


  if (
    pageId ===
    "diariesPage"
  ) {

    renderDiaries();
  }


  if (
    pageId ===
    "profilePage"
  ) {

    renderProfilePage();
  }


  if (
    pageId ===
    "dailyPage"
  ) {

    renderDaily();
  }
}
// ======================================================
// MONTH DETAIL BACK BUTTON
// ======================================================

document.getElementById("backToMonths")?.addEventListener(
  "click",
  () => {
    showPage(monthDetailReturnPage);
  }
);

// ======================================================
// NAV EVENTS
// ======================================================

document
  .querySelectorAll(
    ".nav-item"
  )
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        showPage(
          button.dataset.page
        );

      }
    );

  });


// ======================================================
// PROFILE BUTTON
// ======================================================

document.getElementById(
  "profileBtn"
)?.addEventListener(
  "click",
  () => {

    if (isLoggedIn()) {

      showPage(
        "profilePage"
      );

    } else {

      openAuthModal(
        "login"
      );
    }

  }
);


// ======================================================
// ADD GOAL BUTTONS
// ======================================================

document.getElementById(
  "addGoalBtn"
)?.addEventListener(
  "click",
  openAddGoalModal
);


document.getElementById(
  "addGoalBtn2"
)?.addEventListener(
  "click",
  openAddGoalModal
);


// ======================================================
// ADD DIARY
// ======================================================

document.getElementById(
  "addDiaryBtn"
)?.addEventListener(
  "click",
  openAddDiaryModal
);


// ======================================================
// MODAL CLOSE
// ======================================================

document.getElementById(
  "modalClose"
)?.addEventListener(
  "click",
  closeModal
);


document.getElementById(
  "modal"
)?.addEventListener(
  "click",
  event => {

    if (
      event.target.id ===
      "modal"
    ) {

      closeModal();
    }

  }
);


// ======================================================
// THEME
// ======================================================

function toggleTheme() {

  document.body.classList.toggle(
    "dark"
  );


  localStorage.setItem(
    "progress-theme",
    document.body.classList.contains(
      "dark"
    )
      ? "dark"
      : "light"
  );
}


function loadTheme() {

  const theme =
    localStorage.getItem(
      "progress-theme"
    );


  if (theme === "dark") {

    document.body.classList.add(
      "dark"
    );
  }
}


document.getElementById(
  "themeBtn"
)?.addEventListener(
  "click",
  toggleTheme
);


document.getElementById(
  "themeBtn2"
)?.addEventListener(
  "click",
  toggleTheme
);


// ======================================================
// RESET DATA
// ======================================================

document.getElementById(
  "clearDataBtn"
)?.addEventListener(
  "click",
  async () => {

    if (!isLoggedIn()) {

      goals =
        structuredClone(
          DEFAULT_GOALS
        );

      completions = {};

      diaries = [];

      renderAll();

      return;
    }


    const confirmed =
      confirm(
        "This will permanently delete your goals, progress and diaries from Firebase. Continue?"
      );


    if (!confirmed)
      return;


    try {

      const batch =
        writeBatch(db);


      // Goals

      const goalSnap =
        await getDocs(
          userCollection(
            "goals"
          )
        );

      goalSnap.forEach(
        item =>
          batch.delete(
            item.ref
          )
      );


      // Completions

      const completionSnap =
        await getDocs(
          userCollection(
            "completions"
          )
        );

      completionSnap.forEach(
        item =>
          batch.delete(
            item.ref
          )
      );


      // Diaries

      const diarySnap =
        await getDocs(
          userCollection(
            "diaries"
          )
        );

      diarySnap.forEach(
        item =>
          batch.delete(
            item.ref
          )
      );


      await batch.commit();


      goals =
        structuredClone(
          DEFAULT_GOALS
        );

      completions = {};

      diaries = [];


      for (const goal of goals) {

        await setDoc(
          userDoc(
            "goals",
            goal.id
          ),
          {
            ...goal,
            createdAt:
              serverTimestamp(),
            updatedAt:
              serverTimestamp()
          }
        );
      }


      renderAll();


      alert(
        "Your tracker data has been reset."
      );


    } catch (error) {

      console.error(error);

      alert(
        "Data reset failed."
      );
    }

  }
);


// ======================================================
// GREETING
// ======================================================

function greeting() {

  const hour =
    new Date().getHours();


  if (
    hour >= 5 &&
    hour < 12
  ) {

    return "GOOD MORNING";
  }


  if (
    hour >= 12 &&
    hour < 17
  ) {

    return "GOOD AFTERNOON";
  }


  if (
    hour >= 17 &&
    hour < 21
  ) {

    return "GOOD EVENING";
  }


  return "GOOD NIGHT";
}


function updateGreeting() {

  const element =
    document.getElementById(
      "greeting"
    );


  if (element) {

    element.textContent =
      greeting();
  }
}


// ======================================================
// LIVE CLOCK
// ======================================================

function updateLiveClock() {

  const now =
    new Date();


  const hours =
    String(
      now.getHours()
    ).padStart(
      2,
      "0"
    );


  const minutes =
    String(
      now.getMinutes()
    ).padStart(
      2,
      "0"
    );


  const seconds =
    String(
      now.getSeconds()
    ).padStart(
      2,
      "0"
    );


  const clock =
    document.getElementById(
      "liveClock"
    );


  if (clock) {

    clock.textContent =
      `${hours}:${minutes}:${seconds}`;
  }


  updateGreeting();
}


updateLiveClock();

setInterval(
  updateLiveClock,
  1000
);


// ======================================================
// RENDER ALL
// ======================================================

function renderAll() {

  renderDaily();

  renderMonthly();

  renderMonthDetail();

  renderManageGoals();

  renderDiaries();

  updateProfileButton();

}


// ======================================================
// AUTH STATE EVENTS
// ======================================================

window.addEventListener(
  "userLoggedIn",
  async event => {

    await loadUserData(
      event.detail
    );

    updateProfileButton();

  }
);


window.addEventListener(
  "userLoggedOut",
  () => {

    resetTemporaryData();

    showPage(
      "dailyPage"
    );

  }
);


// ======================================================
// INITIALIZE
// ======================================================

loadTheme();

renderAll();


// Firebase auth state will
// automatically load the user
// if already logged in.