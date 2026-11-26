-- CreateTable: LDAP 目录配置表（单例）
CREATE TABLE `sys_ldap_config` (
    `id` INT NOT NULL DEFAULT 1 COMMENT '主键（固定为 1，保证单例语义）',
    `enabled` BOOLEAN NOT NULL DEFAULT false COMMENT '是否启用 LDAP 认证（关闭时登录只走本地口令）',
    `url` VARCHAR(255) NOT NULL COMMENT '服务器地址（ldap:// 或 ldaps://）',
    `start_tls` BOOLEAN NOT NULL DEFAULT false COMMENT '是否使用 StartTLS 升级连接（ldap:// 时可选）',
    `verify_cert` BOOLEAN NOT NULL DEFAULT true COMMENT '是否校验服务器证书（自签证书的内网目录可关闭，生产不建议）',
    `bind_dn` VARCHAR(255) NOT NULL COMMENT '服务账号 DN（用于搜索用户，如 cn=admin,dc=example,dc=com）',
    `bind_password` VARCHAR(500) NOT NULL COMMENT '服务账号口令（信封加密）',
    `base_dn` VARCHAR(255) NOT NULL COMMENT '用户搜索基准 DN（如 ou=users,dc=example,dc=com）',
    `user_filter` VARCHAR(255) NOT NULL DEFAULT '(uid={{username}})' COMMENT '用户搜索过滤器模板，{{username}} 为占位符（如 (uid={{username}})）',
    `username_attr` VARCHAR(64) NOT NULL DEFAULT 'uid' COMMENT '用户名属性（用于本地账号名映射，如 uid / sAMAccountName）',
    `email_attr` VARCHAR(64) NULL COMMENT '邮箱属性（如 mail）',
    `nickname_attr` VARCHAR(64) NULL COMMENT '昵称属性（如 displayName / cn）',
    `default_role_codes` VARCHAR(255) NULL COMMENT '首次登录自动建号时授予的角色编码（逗号分隔）',
    `updated_at` DATETIME(3) NOT NULL COMMENT '更新时间',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;