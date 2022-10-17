const github = require("@actions/github");
const core = require("@actions/core");

const { Client } = require("@notionhq/client");

const GITHUB_USERNAME = "gsig123";
const GITHUB_REPO_NAME = "github-actions-playground";

const notionPageTitleToIssueTitle = (pageTitle) => {
  return `[Bug] ${pageTitle}`;
};

const issueTitleToNotionPageTitle = (issueTitle) => {
  return issueTitle.split(`[Bug] `)[1];
};

const notionPagePropertiesToTitle = (notionPageProperties) => {
  notionPageProperties?.Name?.title[0]?.plain_text ?? "";
};

async function run() {
  const githubToken = core.getInput("githubToken");
  const notionDbId = core.getInput("notionDbId");
  const notionApiToken = core.getInput("notionApiToken");
  const tagColumnName = core.getInput("tagColumnName");
  const tagValue = core.getInput("tagValue");

  const octokit = github.getOctokit(githubToken);
  const notion = new Client({
    auth: notionApiToken,
  });

  const newIssueCandidates = await notion.databases.query({
    database_id: notionDbId,
    filter: {
      property: tagColumnName,
      select: {
        equals: tagValue,
      },
    },
  });

  const { data: issuesFromRepo } = await octokit.rest.issues.listForRepo({
    owner: GITHUB_USERNAME,
    repo: GITHUB_REPO_NAME,
    per_page: 100, // Ignore pagination for now
    state: "open",
  });

  const existingIssueIds = issuesFromRepo.map((issue) =>
    issueTitleToNotionPageTitle(issue.title)
  );

  const bugsThatNeedIssuesToBeCreated = newIssueCandidates.results.filter(
    ({ properties }) =>
      !existingIssueIds.includes(notionPagePropertiesToTitle(properties))
  );

  bugsThatNeedIssuesToBeCreated.forEach(({ properties, url }) => {
    octokit.rest.issues.create({
      owner: GITHUB_USERNAME,
      repo: GITHUB_REPO_NAME,
      title: notionPageTitleToIssueTitle(
        notionPagePropertiesToTitle(properties)
      ),
      body: url,
      assignees: [GITHUB_USERNAME],
    });
  });
}

run();
