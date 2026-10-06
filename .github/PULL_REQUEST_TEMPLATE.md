## 这个 PR 做了什么

<!-- 一句话说清楚 + 关联的 Issue 号（如 Closes #12） -->

## 类型

- [ ] 新组件 / 新外设
- [ ] Bug 修复
- [ ] 文档 / 示例
- [ ] 其它

## 检查清单（全勾了再提）

- [ ] `node --test` 全绿
- [ ] `node tools/run-example-builds.js` 全过
- [ ] UI 无头自检（`web/_selftest.html`）全绿
- [ ] 改过 `template/`：已重跑 `node tools/embed-template.js`
- [ ] 改过生成代码格式：golden 测试与设计文档 §5.3 已同步
- [ ] 新组件：catalog/codegen 测试 + selftest 小节已加（有校验的补 validate 测试，推荐附示例）
- [ ] `.bat` 改动均为纯 ASCII；未新增任何 npm/第三方依赖

## 真板验证（涉及固件的 PR 必填）

- 板子型号 / 接线：
- 烧录的示例 / 工程：
- 板上实际现象：
- （附积木截图或生成的 `user_code.c` 关键片段）
