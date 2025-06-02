# Issues to Json

Generate JSON from GitHub issues

## Inputs

| Name | Description | Required | Default |
|---|---|---|---|
| `data_path` | 数据文件存储路径 | `false` | `/v2/data.json` |
| `data_version` | 数据结构版本号 | `false` | `v2` |
| `sort` | Issue排序方式和方向 (例如: created-desc, updated-asc, version-desc) | `false` | `created-desc` |
| `exclude_labels` | 需要排除的Issue标签 (逗号分隔) | `false` | `审核中` |

## Usage

To use this action, add the following step to your GitHub Workflow:

```yaml
name: Generate Issues JSON
on:
  schedule:
    - cron: '0 0 * * *' # Runs daily at midnight UTC
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Generate JSON from Issues
        uses: xaoxuu/issues2json@main
        with:
          data_path: './v2/data.json'
          data_version: 'v2'
          sort: 'created-desc'
          exclude_labels: '审核中'

      - name: Commit files
        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git add .
          git commit -m "Update issues data"
          git push
```