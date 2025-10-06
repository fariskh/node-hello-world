import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import simpleGit from "simple-git";

const repoUrl = "https://faris0relias@github.com/relias-engineering/content-library-service.git";
const localPath = "./temp-repo";

const git = simpleGit();




dotenv.config();

const ai = new GoogleGenAI({});
const MAX_FILES_PER_BATCH = 5;
const REPORT_FILE = "review-report.html";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Recursively collect all code files from a folder
 */
const getCodeFiles = (folderPath) => {
  let results = [];
  const items = fs.readdirSync(folderPath);

  for (const item of items) {
    const fullPath = path.join(folderPath, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      results = results.concat(getCodeFiles(fullPath));
    } else if (/\.(js|ts|jsx|tsx|java|py|cs)$/i.test(item)) {
      results.push(fullPath);
    }
  }
  return results;
};

/**
 * Call Gemini with retry logic
 */
async function callGemini(prompt, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash", // ✅ supported
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      return (
        result?.candidates?.[0]?.content?.parts
          ?.map((p) => p.text)
          .join("\n") || "No response text"
      );
    } catch (err) {
      if (err.status === 503 && i < retries - 1) {
        console.warn(`Gemini 503, retrying in ${2 ** i} sec...`);
        await sleep(1000 * 2 ** i);
      } else {
        throw err;
      }
    }
  }
}

export const gemini = async () => {
  try {
    await git.clone(repoUrl, localPath);
    const folderPath = `${localPath}/src`; // change to your target folder
    const guidelinesPath = "./copilot/code/auditor/backend/codeauditor.md"; // your MD file

    const allFiles = getCodeFiles(folderPath);
    const guidelines = fs.readFileSync(guidelinesPath, "utf-8");

    // reset report file
    fs.writeFileSync(REPORT_FILE, "# Gemini Code Review Report\n\n");

    for (let i = 0; i < allFiles.length; i += MAX_FILES_PER_BATCH) {
      const batch = allFiles.slice(i, i + MAX_FILES_PER_BATCH);
      let codeContent = "";

      for (const file of batch) {
        const content = fs.readFileSync(file, "utf-8");
        codeContent += `\n\n=== File: ${path.relative(folderPath, file)} ===\n${content}`;
      }

      const prompt = `
Review the code as per the guidelines below and provide a detailed code review in HTML format. The final report must be in pure HTML <table> format, not Markdown.

Guidelines:
${guidelines}

Code to review:
${codeContent}
`;


      console.log(`\n🔍 Sending batch (${i + 1} - ${i + batch.length}) to Gemini...`);

      const review = await callGemini(prompt);

      fs.appendFileSync(
        REPORT_FILE,
        `\n\n## Review for files: ${batch.map((f) => path.basename(f)).join(", ")}\n\n${review}\n`
      );
    }
    fs.rm(localPath, { recursive: true, force: true });
    console.log(`\n✅ Review completed. Results saved to ${REPORT_FILE}`);
  } catch (error) {
    fs.rm(localPath, { recursive: true, force: true });
    console.error("Error during Gemini review:", error);
  }
};

gemini();
