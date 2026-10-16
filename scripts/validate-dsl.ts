import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { lessonSpecSchema } from "../packages/core/src/dsl/schema";

// Validates all Lesson DSL fixtures in content/fixtures
// (specifications/10-build-plan.md P0-07).

function main() {
  const fixturesDir = join(process.cwd(), "content", "fixtures");
  const validFile = join(fixturesDir, "slope-of-a-curve.json");

  console.log("--- Validating valid fixture ---");
  const validContent = JSON.parse(readFileSync(validFile, "utf-8"));
  const validResult = lessonSpecSchema.safeParse(validContent);
  if (!validResult.success) {
    console.error("FAIL: valid fixture slope-of-a-curve.json failed validation:");
    console.error(validResult.error.format());
    process.exit(1);
  }
  console.log("PASS: slope-of-a-curve.json is valid.");

  console.log("\n--- Validating invalid fixtures ---");
  const invalidDir = join(fixturesDir, "invalid");
  const invalidFiles = readdirSync(invalidDir).filter((f) => f.endsWith(".json"));

  let allInvalidPassed = true;
  for (const file of invalidFiles) {
    const filePath = join(invalidDir, file);
    try {
      const content = JSON.parse(readFileSync(filePath, "utf-8"));
      const result = lessonSpecSchema.safeParse(content);
      if (result.success) {
        console.error(`FAIL: ${file} was expected to fail validation, but it passed.`);
        allInvalidPassed = false;
      } else {
        const errorMsg = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
        console.log(`PASS: ${file} failed as expected -> ${errorMsg}`);
      }
    } catch (err: unknown) {
      // JSON parse error (e.g. control characters) also counts as failing invalid fixture
      console.log(`PASS: ${file} failed with JSON parse error -> ${(err as Error).message}`);
    }
  }

  if (!allInvalidPassed) {
    process.exit(1);
  }
  console.log("\nALL DSL fixtures validated successfully!");
}

main();
