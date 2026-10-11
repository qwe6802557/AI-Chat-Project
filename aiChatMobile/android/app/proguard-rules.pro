# Flutter 核心引擎与插件通信
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.util.** { *; }
-keep class io.flutter.view.** { *; }
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }

# 应用主入口
-keep class com.example.ai_chat_mobile.** { *; }

# Shorebird 热更新运行库
-keep class io.shorebird.** { *; }
-keep class com.shorebird.** { *; }

# 原生硬件交互与多媒体插件
-keep class xyz.luan.audioplayers.** { *; }
-keep class com.llfbandit.record.** { *; }
-keep class com.mr.flutter.plugin.filepicker.** { *; }

# 系统服务、持久化存储与跳转插件
-keep class com.it_nomads.fluttersecurestorage.** { *; }
-keep class io.flutter.plugins.sharedpreferences.** { *; }
-keep class io.flutter.plugins.pathprovider.** { *; }
-keep class io.flutter.plugins.urllauncher.** { *; }
-keep class com.restartapp.** { *; }

# 忽略无关第三方警告
-dontwarn io.flutter.**
-dontwarn io.shorebird.**
-dontwarn javax.annotation.**
