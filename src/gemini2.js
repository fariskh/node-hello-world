import fetch from "node-fetch";

// Function to review a GitHub Pull Request with Gemini
export async function reviewPullRequest({ owner, repo, pull_number, githubToken, geminiApiKey }) {
  // Step 1: Fetch PR changed files from GitHub API
  const ghResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${pull_number}/files`,
    {
      headers: {
        "Authorization": `Bearer ${githubToken}`,
        "Accept": "application/vnd.github+json",
      },
    }
  );

  if (!ghResponse.ok) {
    throw new Error(`GitHub API error: ${ghResponse.status} ${ghResponse.statusText}`);
  }

  const files = await ghResponse.json();

  // Collect diffs (patches)
  const diffs = files
    .map(file => `File: ${file.filename}\nPatch:\n${file.patch || "(binary file skipped)"}`)
    .join("\n\n");

  // Step 2: Build prompt for Gemini
  const prompt = `
You are a code review assistant. Review the following Pull Request patches.
Point out security, performance, and best practices issues. Return your review in markdown.

${diffs}
`;

  // Step 3: Call Gemini API
  const geminiResponse = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" + geminiApiKey,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
    }
  );

  if (!geminiResponse.ok) {
    throw new Error(`Gemini API error: ${geminiResponse.status} ${geminiResponse.statusText}`);
  }

  const result = await geminiResponse.json();

  // Step 4: Extract review text
  const reviewText = result?.candidates?.[0]?.content?.parts?.[0]?.text || "No response";

  return reviewText;
}

// Example usage:
(async () => {
  const review = await reviewPullRequest({
    owner: "your-org",
    repo: "your-repo",
    pull_number: 123,
    githubToken: process.env.GITHUB_TOKEN,
    geminiApiKey: process.env.GEMINI_API_KEY,
  });

  console.log("Gemini Review:\n", review);
})();
