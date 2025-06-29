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

  async getIssues(exclude_issue_with_labels) {
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

      if (!exclude_issue_with_labels || exclude_issue_with_labels.length === 0) {
        return issues;
      }

      // 过滤掉包含 exclude_issue_with_labels 中定义的标签的 Issue
      const filteredIssues = issues.filter(issue => {
        const issueLabels = issue.labels.map(label => label.name);
        return !exclude_issue_with_labels.some(excludeLabel => issueLabels.includes(excludeLabel));
      });
      
      logger('info', `经过[${exclude_issue_with_labels}]过滤后还有${filteredIssues.length}个: ${filteredIssues.map(item => item.number).join(',')}`);
      return filteredIssues;
    } catch (error) {
      logger('error', '获取issues失败');
      throw error;
    }
  }

}

export function hexToHsl(hex) {
  if (!hex) return null;
  // 移除#号
  hex = hex.replace(/^#/, '');

  // 转换成RGB
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);

  // 归一化RGB值
  r /= 255, g /= 255, b /= 255;

  let max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    let d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}