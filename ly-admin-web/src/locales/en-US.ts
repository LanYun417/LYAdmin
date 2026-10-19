/**
 * English locale pack.
 * 与 zh-CN 保持**完全一致的 key 结构**：少一个 key 就会在英文界面露出中文或 key 本身。
 * 新增文案时的顺序：先在 zh-CN 加（基准），再在 en-US 补；两处 key 数量应保持一致。
 */
export default {
  common: {
    confirm: 'OK',
    cancel: 'Cancel',
    search: 'Search',
    reset: 'Reset',
    create: 'Create',
    edit: 'Edit',
    delete: 'Delete',
    batchDelete: 'Batch delete',
    import: 'Import',
    export: 'Export',
    refresh: 'Refresh',
    readAll: 'Mark all read',
    loading: 'Loading',
    empty: 'No data',
    total: '{count} in total',
    success: 'Done',
    failed: 'Failed',
  },
  nav: {
    notice: 'Notifications',
    viewAll: 'View all',
    language: 'Language',
    theme: 'Theme',
    fullscreen: 'Full screen',
    exitFullscreen: 'Exit full screen',
  },
  login: {
    title: 'Admin Console',
    subtitle: 'Welcome back, please sign in',
    username: 'Username',
    password: 'Password',
    captcha: 'Captcha',
    submit: 'Sign in',
    success: 'Signed in',
    failed: 'Sign-in failed',
    usernameRequired: 'Please enter username',
    passwordRequired: 'Please enter password',
  },
  notice: {
    title: 'Notifications',
    unread: 'Unread',
    read: 'Read',
    allRead: 'All marked as read',
    empty: 'No notifications',
    center: 'Notification center',
    myNotice: 'My notifications',
    publish: 'Publish notice',
    clear: 'Clear',
  },
};
