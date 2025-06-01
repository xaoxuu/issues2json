import fs from 'fs';
import path from 'path';
import { Octokit } from '@octokit/rest';
import * as github from '@actions/github';

export function logger(level, message, ...args) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, ...args);
}

export function handleError(error, context) {
  if (error.response) {
    logger('error', `${context}: ${error.response.status} - ${error.response.statusText} - ${JSON.stringify(error.response.data)}`);
  } else if (error.request) {
    logger('error', `${context}: No response received`);
  } else {
    logger('error', `${context}: ${error.message}`);
  }
}

export function writeJsonToFile(filePath, data) {
  try {
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    handleError(error, `Error writing to file ${filePath}`);
    return false;
  }
}


export class IssueManager {
  constructor(token) {
    this.octokit = new Octokit({
      auth: token
    });
  }

  async getIssues(exclude_labels) {
    const { owner, repo } = github.context.repo;
    try {
      // 使用 paginate 方法一次性获取所有 issues
      const issues = await this.octokit.paginate(this.octokit.issues.listForRepo, {
        owner,
        repo,
        state: 'open',
        per_page: 100,
        sort: 'created',
        direction: 'desc'
      });
      logger('info', `一共有${issues.length}个打开的issues: ${issues.map(item => item.number).join(',')}`);

      if (!exclude_labels || exclude_labels.length === 0) {
        return issues;
      }

      // 过滤掉包含 exclude_labels 中定义的标签的 Issue
      const filteredIssues = issues.filter(issue => {
        const issueLabels = issue.labels.map(label => label.name);
        return !exclude_labels.some(excludeLabel => issueLabels.includes(excludeLabel));
      });
      
      logger('info', `经过[${exclude_labels}]过滤后还有${filteredIssues.length}个: ${filteredIssues.map(item => item.number).join(',')}`);
      return filteredIssues;
    } catch (error) {
      logger('error', '获取issues失败');
      throw error;
    }
  }

}