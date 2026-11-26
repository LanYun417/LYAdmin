-- CreateIndex: sys_api_key.key_hash 唯一约束（两把 Key 撞哈希即账号混淆，必须唯一）
CREATE UNIQUE INDEX `sys_api_key_key_hash_key` ON `sys_api_key`(`key_hash`);