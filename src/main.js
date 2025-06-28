import path from 'path';
import { logger, handleError, IssueManager, writeJsonToFile, hexToHsl } from './utils.js';
import * as core from '@actions/core';


const config = {
  data_version: 'v2',
  data_path: core.getInput('data_path') || '/v2/data.json',
  sort: core.getInput('sort') || 'created-desc',
  exclude_issue_with_labels: (core.getInput('exclude_issue_with_labels') || '审核中').split(',').map(s => s.trim()).filter(label => label.length > 0),
  hide_labels: (core.getInput('hide_labels') || '白名单').split(',').map(s => s.trim()).filter(label => label.length > 0),
  github_token: process.env.GITHUB_TOKEN,
};

async function processIssue(issue) {
  try {
    logger('info', `Processing issue #${issue.number}`);
    if (!issue.body) {
      logger('warn', `Issue #${issue.number} has no body content, skipping...`);
      return null;
    }

    const match = issue.body.match(/```json\s*\{[\s\S]*?\}\s*```/m);
    const jsonMatch = match ? match[0].match(/\{[\s\S]*\}/m) : null;

    if (!jsonMatch) {
      logger('warn', `No JSON content found in issue #${issue.number}`);
      return null;
    }

    // 解析 JSON 内容
    var jsonData = JSON.parse(jsonMatch[0]);

    jsonData.issue_number = issue.number;
    jsonData.labels = issue.labels.filter(label => !config.hide_labels.includes(label.name)).map(label => {
      const hsl = hexToHsl(label.color);
      return {
        name: label.name,
        color: label.color,
        hue: hsl ? hsl.h : 0,
        saturation: hsl? hsl.s : 0,
        lightness: hsl? hsl.l : 0
      };
    });

    // 如果 icon 为空或者无法访问，就设置为创建该issue用户的头像
    if (!jsonData.icon || jsonData.icon.length === 0) {
      if (issue.user.gravatar_id?.length > 0) {
        // 优先使用 gravatar_id 字段组合头像
        jsonData.icon = `https://cn.cravatar.com/avatar/${issue.user.gravatar_id}?s=256&d=identicon`;
      } else {
        // 如果 gravatar_id 字段也不存在，使用用户的头像
        jsonData.icon = issue.user.avatar_url;
      }
    }

    logger('info', `#${issue.number} output jsonData: ${JSON.stringify(jsonData)}`);
    return jsonData;
  } catch (error) {
    handleError(error, `Error processing issue #${issue.number}`);
    return null;
  }
}

async function parseIssues() {

  try {
    const issueManager = new IssueManager(config.github_token);
    var issues = await issueManager.getIssues(config.exclude_issue_with_labels);
    logger('info', `Found ${issues.length} issues to process`);

    const parsedData = {
      version: config.data_version,
      content: []
    };

    // 先处理所有的 issues，然后再根据排序方式进行排序
    for (let issue of issues) {
      const processedData = await processIssue(issue);
      if (processedData) {
        issue.jsonData = processedData;
      }
    }

    // 过滤掉没有解析成功的 issues
    issues = issues.filter(issue => issue.jsonData);

    // 根据配置的排序方式进行排序
    let sortedIssues = issues;
    if (config.sort.includes('created') || config.sort.includes('updated')) {
      const [sortFieldRaw, sortDirection] = config.sort.split('-');
      const sortField = sortFieldRaw === 'created' ? 'created_at' : 'updated_at'; // 修正字段名
      sortedIssues = issues.sort((a, b) => {
        const dateA = new Date(a[sortField]);
        const dateB = new Date(b[sortField]);
        if (sortDirection === 'asc') {
          return dateA.getTime() - dateB.getTime();
        } else {
          return dateB.getTime() - dateA.getTime();
        }
      });
    } else if (config.sort === 'posts-desc') {
      sortedIssues = issues.sort((a, b) => {
        const getPublishedDate = (issue) => {
          try {
            const jsonData = issue.jsonData;
            if (jsonData.posts && jsonData.posts.length > 0 && jsonData.posts[0].published) {
              return new Date(jsonData.posts[0].published);
            }
          } catch (e) {
            logger('warn', `Failed to parse JSON or get published date for issue ${issue.number}: ${e.message}`);
          }
          return null;
        };
        const dateA = getPublishedDate(a);
        const dateB = getPublishedDate(b);
        if (dateA === null && dateB === null) return new Date(b.created_at) - new Date(a.created_at);
        else if (dateA === null || dateB === null) return (dateA === null) - (dateB === null); // If between date and null, null comes first
        else return dateB.getTime() - dateA.getTime(); // Descending order
      });
    } else {
      // 对 issues 进行版本号排序
      sortedIssues = issues.sort((a, b) => {
        const getVersionLabel = (issue) => {
          const versionLabel = issue.labels.find(label => /^v?\d+\.\d+\.\d+$/.test(label.name));
          return versionLabel ? versionLabel.name.replace(/^v/, '') : '0.0.0';
        };

        const versionA = getVersionLabel(a).split('.').map(Number);
        const versionB = getVersionLabel(b).split('.').map(Number);
        for (let i = 0; i < 3; i++) {
          if (versionA[i] !== versionB[i]) {
            return versionB[i] - versionA[i];
          }
        }
        return 0;
      });
    }

    logger('info', `Sorted by ${config.sort}, issues: ${sortedIssues.map(item => item.number).join(',')}`);

    for (const issue of sortedIssues) {
      const processedData = issue.jsonData;
      if (processedData) {
        parsedData.content.push(processedData);
      }
    }

    const outputPath = path.join(process.cwd(), config.data_path);
    if (writeJsonToFile(outputPath, parsedData)) {
      logger('info', `Successfully generated ${outputPath}`);
    }

  } catch (error) {
    handleError(error, 'Error processing issues');
    process.exit(1);
  }
}

parseIssues();
