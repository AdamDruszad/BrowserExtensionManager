const grid = document.querySelector(".extensions-grid");

// Select all three filter buttons
const filterButtons = document.querySelectorAll(".filter-buttons button");

// Destructure buttons for easier access by index
const btnAll = filterButtons[0];
const btnActive = filterButtons[1];
const btnInactive = filterButtons[2];

// Array to store all extension data globally
let allData = [];

// 1. Function to render the cards based on the provided list
function renderCards(dataList) {
  // Clear the grid before rendering
  grid.innerHTML = "";

  // Loop through the data list
  for (let i = 0; i < dataList.length; i++) {
    let extension = dataList[i];
    let isChecked = extension.isActive ? "checked" : "";

    let cardHTML = `
      <article class="card">
        <div class="card-info">
          <img src="${extension.logo}" alt="Icon" />
          <div class="card-text">
            <h3>${extension.name}</h3>
            <p>${extension.description}</p>
          </div>
        </div>
        <div class="card-actions">
          <button class="remove-btn" data-name="${extension.name}">Remove</button>
          <label class="toggle-switch">
            <input type="checkbox" ${isChecked} />
            <span class="slider"></span>
          </label>
        </div>
      </article>
    `;

    grid.innerHTML += cardHTML;
  }
}

// 2. Fetch data from JSON and initialize the render function
fetch("./data.json")
  .then((response) => response.json())
  .then((data) => {
    // Store the fetched data in the global variable
    allData = data;

    // Initial render with all data
    renderCards(allData);
  });

// -- "ACTIVE" BUTTON LOGIC --
btnActive.addEventListener("click", () => {
  // Filter for active extensions
  let activeList = allData.filter((item) => item.isActive === true);

  renderCards(activeList);
  setActiveButton(btnActive);
});

// -- "INACTIVE" BUTTON LOGIC --
btnInactive.addEventListener("click", () => {
  // Filter for inactive extensions
  let inactiveList = allData.filter((item) => item.isActive === false);

  renderCards(inactiveList);
  setActiveButton(btnInactive);
});

// -- "ALL" BUTTON LOGIC --
btnAll.addEventListener("click", () => {
  // Render all data without filtering
  renderCards(allData);
  setActiveButton(btnAll);
});

// Function to handle the active state styling of the filter buttons
function setActiveButton(clickedButton) {
  // Remove 'active-btn' class from all buttons
  btnAll.classList.remove("active-btn");
  btnActive.classList.remove("active-btn");
  btnInactive.classList.remove("active-btn");

  // Add 'active-btn' class to the clicked button
  clickedButton.classList.add("active-btn");
}

// -- THEME SWITCHER LOGIC --
const themeButton = document.querySelector(".switcher");
const themeIcon = document.querySelector(".switcher img");
const logoIcon = document.querySelector(".logo");

themeButton.addEventListener("click", () => {
  // Toggle the 'light-theme' class on the body
  document.body.classList.toggle("light-theme");

  // Update icons based on the current theme
  if (document.body.classList.contains("light-theme")) {
    themeIcon.src = "./assets/images/icon-moon.svg";
    logoIcon.src = "./assets/images/logo.svg";
  } else {
    themeIcon.src = "./assets/images/icon-sun.svg";
    logoIcon.src = "./assets/images/logo_white.svg";
  }
});

// -- REMOVE CARD LOGIC (Event Delegation) --
grid.addEventListener("click", (event) => {
  // Check if the clicked element has the 'remove-btn' class
  if (event.target.classList.contains("remove-btn")) {
    // 1. Get the name of the extension to delete
    let nameToDelete = event.target.dataset.name;

    // 2. Find the closest parent with the class '.card' and remove it from the screen
    event.target.closest(".card").remove();

    // 3. Remove the item from the global data array
    allData = allData.filter((item) => item.name !== nameToDelete);
  }
});
