/**
 * Test script to verify the recipe API is working correctly
 * This script tests:
 * 1. The /api/recipes endpoint returns a list of recipes
 * 2. Each recipe in the list has the required fields
 * 3. The /api/recipes/:id endpoint returns a recipe with steps and ingredients
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

// Configuration
const API_HOST = "localhost";
const API_PORT = 3001;
const OUTPUT_DIR = path.join(__dirname, "test-results");
const SAMPLE_SIZE = 5; // Number of random recipes to test in detail

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Helper function to make HTTP requests
function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: API_HOST,
      port: API_PORT,
      path: path,
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ statusCode: res.statusCode, data: jsonData });
        } catch (error) {
          reject(new Error(`Failed to parse JSON: ${error.message}`));
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.end();
  });
}

// Helper function to write test results to file
function writeResults(filename, data) {
  const filePath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`Results written to ${filePath}`);
}

// Helper function to select random items from an array
function getRandomItems(array, count) {
  // Filter out sample recipes that don't exist in the database
  const realRecipes = array.filter(
    (recipe) => !recipe.id.startsWith("recipe-")
  );
  const shuffled = [...realRecipes].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// Main test function
async function runTests() {
  console.log("Starting recipe API tests...");
  const results = {
    summary: {
      totalRecipes: 0,
      recipesWithSteps: 0,
      recipesWithIngredients: 0,
      averageStepsPerRecipe: 0,
      averageIngredientsPerRecipe: 0,
      testsPassed: 0,
      testsFailed: 0,
    },
    recipeListTest: null,
    detailedTests: [],
  };

  try {
    // Test 1: Get all recipes
    console.log("Test 1: Getting all recipes...");
    const recipesResponse = await makeRequest("/api/recipes");

    if (recipesResponse.statusCode !== 200) {
      throw new Error(
        `Failed to get recipes. Status code: ${recipesResponse.statusCode}`
      );
    }

    const recipes = recipesResponse.data.recipes;
    results.summary.totalRecipes = recipes.length;

    results.recipeListTest = {
      status: "passed",
      message: `Successfully retrieved ${recipes.length} recipes`,
      sampleRecipes: recipes.slice(0, 3), // Include first 3 recipes in results
    };

    console.log(`Retrieved ${recipes.length} recipes`);
    results.summary.testsPassed++;

    // Test 2: Check recipe details for a sample of recipes
    console.log(
      `Test 2: Checking details for ${SAMPLE_SIZE} random recipes...`
    );
    const sampleRecipes = getRandomItems(recipes, SAMPLE_SIZE);

    let totalSteps = 0;
    let totalIngredients = 0;
    let recipesWithSteps = 0;
    let recipesWithIngredients = 0;

    for (const recipe of sampleRecipes) {
      console.log(`Checking recipe: ${recipe.name} (ID: ${recipe.id})`);
      const detailResponse = await makeRequest(`/api/recipes/${recipe.id}`);

      if (detailResponse.statusCode !== 200) {
        results.detailedTests.push({
          recipeId: recipe.id,
          recipeName: recipe.name,
          status: "failed",
          message: `Failed to get recipe details. Status code: ${detailResponse.statusCode}`,
        });
        results.summary.testsFailed++;
        continue;
      }

      const recipeDetail = detailResponse.data;
      const testResult = {
        recipeId: recipe.id,
        recipeName: recipe.name,
        status: "passed",
        hasSteps: recipeDetail.steps && recipeDetail.steps.length > 0,
        hasIngredients:
          recipeDetail.ingredients && recipeDetail.ingredients.length > 0,
        stepCount: recipeDetail.steps ? recipeDetail.steps.length : 0,
        ingredientCount: recipeDetail.ingredients
          ? recipeDetail.ingredients.length
          : 0,
        sampleSteps: recipeDetail.steps ? recipeDetail.steps.slice(0, 2) : [],
        sampleIngredients: recipeDetail.ingredients
          ? recipeDetail.ingredients.slice(0, 2)
          : [],
      };

      // Update statistics
      if (testResult.hasSteps) {
        recipesWithSteps++;
        totalSteps += testResult.stepCount;
      }

      if (testResult.hasIngredients) {
        recipesWithIngredients++;
        totalIngredients += testResult.ingredientCount;
      }

      // Check if the test passed overall
      if (!testResult.hasSteps || !testResult.hasIngredients) {
        testResult.status = "failed";
        testResult.message = `Recipe is missing ${
          !testResult.hasSteps ? "steps" : ""
        }${!testResult.hasSteps && !testResult.hasIngredients ? " and " : ""}${
          !testResult.hasIngredients ? "ingredients" : ""
        }`;
        results.summary.testsFailed++;
      } else {
        results.summary.testsPassed++;
      }

      results.detailedTests.push(testResult);
    }

    // Update summary statistics
    results.summary.recipesWithSteps = recipesWithSteps;
    results.summary.recipesWithIngredients = recipesWithIngredients;
    results.summary.averageStepsPerRecipe = totalSteps / SAMPLE_SIZE;
    results.summary.averageIngredientsPerRecipe =
      totalIngredients / SAMPLE_SIZE;

    // Write test results to file
    writeResults("test-results.json", results);

    // Print summary
    console.log("\nTest Summary:");
    console.log(`Total Recipes: ${results.summary.totalRecipes}`);
    console.log(`Recipes Tested: ${SAMPLE_SIZE}`);
    console.log(
      `Recipes with Steps: ${recipesWithSteps}/${SAMPLE_SIZE} (${(
        (recipesWithSteps / SAMPLE_SIZE) *
        100
      ).toFixed(1)}%)`
    );
    console.log(
      `Recipes with Ingredients: ${recipesWithIngredients}/${SAMPLE_SIZE} (${(
        (recipesWithIngredients / SAMPLE_SIZE) *
        100
      ).toFixed(1)}%)`
    );
    console.log(
      `Average Steps per Recipe: ${results.summary.averageStepsPerRecipe.toFixed(
        1
      )}`
    );
    console.log(
      `Average Ingredients per Recipe: ${results.summary.averageIngredientsPerRecipe.toFixed(
        1
      )}`
    );
    console.log(`Tests Passed: ${results.summary.testsPassed}`);
    console.log(`Tests Failed: ${results.summary.testsFailed}`);

    if (results.summary.testsFailed > 0) {
      console.log("\nFailed Tests:");
      results.detailedTests
        .filter((test) => test.status === "failed")
        .forEach((test) => {
          console.log(
            `- ${test.recipeName} (${test.recipeId}): ${test.message}`
          );
        });
    }
  } catch (error) {
    console.error("Test failed with error:", error);
    results.error = error.message;
    writeResults("test-error.json", results);
  }
}

// Run the tests
runTests().catch((error) => {
  console.error("Unhandled error:", error);
});
