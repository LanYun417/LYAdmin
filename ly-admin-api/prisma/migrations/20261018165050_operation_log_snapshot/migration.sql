-- AlterTable
ALTER TABLE `sys_operation_log` ADD COLUMN `after_data` VARCHAR(2000) NULL,
    ADD COLUMN `before_data` VARCHAR(2000) NULL;
