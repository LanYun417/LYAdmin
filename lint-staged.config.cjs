/**
 * lint-staged 配置：对暂存区文件按类型分派 lint / format。
 */
module.exports = {
  '*.{js,mjs,cjs,ts,vue}': ['eslint --fix', 'prettier --write'],
  '*.{json,css,scss,md,html,yml,yaml}': ['prettier --write'],
  '*.{css,scss,vue}': ['stylelint --fix --allow-empty-input'],
};
