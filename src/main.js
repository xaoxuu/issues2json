import path from 'path';
import { logger, handleError, IssueManager, writeJsonToFile } from './utils.js';
import * as core from '@actions/core';


const config = {
  data_version: core.getInput('data_version') || 'v2',
  data_path: core.getInput('data_path') || '/v2/data.json',
  sort: core.getInput('sort') || 'created-desc',
  exclude_labels: (core.getInput('exclude_labels') || '审核中, 无法访问').split(',').map(s => s.trim()).filter(label => label.length > 0),
  github_token: core.getInput('github_token') || process.env.GITHUB_TOKEN,
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
    jsonData.labels = issue.labels.map(label => ({
      name: label.name,
      color: label.color
    }));
    
    // 如果 icon 为空或者无法访问，就设置为创建该issue用户的头像
    let isIconValid = false;
    if (jsonData.icon?.length > 0) {
      try {
        // 简单的URL格式校验
        new URL(jsonData.icon);
        const response = await fetch(jsonData.icon, { method: 'HEAD', signal: AbortSignal.timeout(5000) }); // 增加5秒超时
        logger('info', `Icon URL ${jsonData.icon}, response status: ${response.status}, isok: ${response.ok}`);
        if (response.ok) {
          isIconValid = true;
        }
      } catch (error) {
        logger('warn', `Icon URL ${jsonData.icon} is not valid or accessible: ${error.message}`);
      }
    }
    logger('info', `#${issue.number} Icon URL ${jsonData.icon} is valid: ${isIconValid}`);
    if (!isIconValid) {
      if (issue.user.gravatar_id?.length > 0) {
        // 优先使用 gravatar_id 字段组合头像
        jsonData.icon = `https://gravatar.com/avatar/${issue.user.gravatar_id}?s=256&d=identicon`;  
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
    const issues = await issueManager.getIssues(config.exclude_labels);
    logger('info', `Found ${issues.length} issues to process`);

    const parsedData = {
      version: config.data_version,
      content: []
    };

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
    } else {
      // 对 issues 进行版本号排序
      sortedIssues = issues.sort((a, b) => {
        const getVersionLabel = (issue) => {
          const versionLabel = issue.labels.find(label => /^\d+\.\d+\.\d+$/.test(label.name));
          return versionLabel ? versionLabel.name : '0.0.0';
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
      const processedData = await processIssue(issue);
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
