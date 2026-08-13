// FOR TESTING
//
// for (let number = 0; number < 10; number += 1) {
//   const tasker = createRandomTasker();

//   gameState.collection.push(tasker);
//   movingCharacters.push(
//     new MovingCharacter(tasker, performance.now())
//   );
// }

// updateCollectionStats();
// saveState();
// renderStats();
// renderTaskerdex();

// the starting point
updateCollectionStats();
saveState();
gameState.collection.forEach((tasker) => {
  movingCharacters.push(new MovingCharacter(tasker, performance.now()));
});
renderTasks();
renderEgg();
renderStats();
renderTaskerdex();
applyMood();
renderPlatforms();

let previousTime = performance.now();
function animateCharacters(currentTime) {
  const elapsedSeconds = Math.min((currentTime - previousTime) / 1000, 0.05);
  movingCharacters.forEach((character) => character.update(currentTime, elapsedSeconds));
  previousTime = currentTime;
  requestAnimationFrame(animateCharacters);
}
requestAnimationFrame(animateCharacters);

// moods update gradually while the page stays open; completing a task updates immediately.
setInterval(applyMood, 60000);
setInterval(() => {
  updateTaskTimers();
}, 250);

window.addEventListener("resize", renderPlatforms);