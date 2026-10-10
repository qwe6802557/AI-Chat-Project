allprojects {
    repositories {
        maven(url = "https://maven.aliyun.com/repository/public")
        maven(url = "https://maven.aliyun.com/repository/google")
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

subprojects {
    if (name != "app") {
        afterEvaluate {
            val android = extensions.findByName("android")
            android?.javaClass?.methods?.forEach { method ->
                if (method.name == "setCompileSdk" || method.name == "setCompileSdkVersion" || method.name == "compileSdkVersion") {
                    try {
                        val paramType = method.parameterTypes.firstOrNull()
                        if (paramType == Int::class.javaPrimitiveType || paramType == java.lang.Integer::class.java) {
                            method.invoke(android, 36)
                        } else if (paramType == String::class.java) {
                            method.invoke(android, "android-36")
                        }
                    } catch (e: Exception) {}
                }
            }
        }
    }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
