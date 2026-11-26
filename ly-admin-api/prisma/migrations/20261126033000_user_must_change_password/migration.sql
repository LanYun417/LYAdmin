-- AlterTable: 用户表新增「强制修改初始口令」标记
ALTER TABLE `sys_user` ADD COLUMN `must_change_password` TINYINT NOT NULL DEFAULT 0 COMMENT '是否需要强制修改初始口令：1 = 登录后必须改密';