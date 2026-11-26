-- AlterTable: 操作日志表新增「字段级差异」列
ALTER TABLE `sys_operation_log` ADD COLUMN `diff` VARCHAR(2000) NULL COMMENT '字段级差异（JSON 文本：仅列发生变化字段的前后值；删除字段标 __deleted__，新增标 __added__）';
