const { existsSync } = require("fs");
// @ts-ignore
const path = require("path");
const atlasToJson = require("./atlas2json");

const execute = command =>
    require("child_process").execSync(command, {
        encoding: "utf-8",
    });

// Globs for atlas resources
const rawImageResourcesGlobs = ["../res_raw/atlas.json", "../res_raw/**/*.png"];

// Globs for non-ui resources
const nonImageResourcesGlobs = ["../res/**/*.woff2", "../res/*.ico", "../res/**/*.webm"];

// Globs for ui resources
const imageResourcesGlobs = ["../res/**/*.png", "../res/**/*.svg", "../res/**/*.jpg", "../res/**/*.gif"];

// Link to download LibGDX runnable-texturepacker.jar
const runnableTPSource = "https://libgdx-nightlies.s3.eu-central-1.amazonaws.com/libgdx-runnables/runnable-texturepacker.jar";

function gulptasksImageResources($, gulp, buildFolder) {
    // 标记Java是否可用（全局状态）
    let isJavaAvailable = false;

    // 提前检查Java可用性
    try {
        execute("java -version");
        isJavaAvailable = true;
        console.log("Java is available, will process atlas tasks");
    } catch (err) {
        isJavaAvailable = false;
        console.warn("Java not found or not working - atlas-related tasks will be skipped");
    }

    // Lossless options
    const minifyImagesOptsLossless = () => [
        $.imageminJpegtran({
            progressive: true,
        }),
        $.imagemin.svgo({}),
        $.imagemin.optipng({
            optimizationLevel: 3,
        }),
        $.imageminGifsicle({
            optimizationLevel: 3,
            colors: 128,
        }),
    ];

    // Lossy options
    const minifyImagesOpts = () => [
        $.imagemin.mozjpeg({
            quality: 80,
            maxMemory: 1024 * 1024 * 8,
        }),
        $.imagemin.svgo({}),
        $.imageminPngquant({
            speed: 1,
            strip: true,
            quality: [0.65, 0.9],
            dithering: false,
            verbose: false,
        }),
        $.imagemin.optipng({
            optimizationLevel: 3,
        }),
        $.imageminGifsicle({
            optimizationLevel: 3,
            colors: 128,
        }),
    ];

    // Where the resources folder are
    const resourcesDestFolder = path.join(buildFolder, "res");

    /**
     * Determines if an atlas must use lossless compression
     * @param {string} fname
     */
    function fileMustBeLossless(fname) {
        return fname.indexOf("lossless") >= 0;
    }

    /////////////// ATLAS（依赖Java的任务） /////////////////////

    // 构建 atlas 任务（仅当Java可用时执行）
    gulp.task("imgres.buildAtlas", cb => {
        // 如果Java不可用，直接跳过
        if (!isJavaAvailable) {
            console.warn("Skipping imgres.buildAtlas - Java is required");
            cb();
            return;
        }

        const config = JSON.stringify("../res_raw/atlas.json");
        const source = JSON.stringify("../res_raw");
        const dest = JSON.stringify("../res_built/atlas");

        try {
            // 检查并下载纹理打包工具
            if (!existsSync("./runnable-texturepacker.jar")) {
                const safeLink = JSON.stringify(runnableTPSource);
                const commands = [
                    `wget -O runnable-texturepacker.jar ${safeLink}`,
                    `curl -o runnable-texturepacker.jar ${safeLink}`,
                    "powershell.exe -Command (new-object System.Net.WebClient)" +
                        `.DownloadFile(${safeLink.replace(/"/g, "'")}, 'runnable-texturepacker.jar')`,
                    `certutil.exe -urlcache -split -f ${safeLink} runnable-texturepacker.jar`,
                ];

                let downloadSuccess = false;
                while (commands.length) {
                    try {
                        execute(commands.shift());
                        downloadSuccess = true;
                        break;
                    } catch {
                        // 忽略单个下载命令的失败，尝试下一个
                    }
                }

                if (!downloadSuccess) {
                    console.warn("Failed to download runnable-texturepacker.jar - skipping atlas build");
                    cb();
                    return;
                }
            }

            // 执行纹理打包
            execute(`java -jar runnable-texturepacker.jar ${source} ${dest} atlas0 ${config}`);
        } catch (err) {
            console.warn(" atlas build failed:", err.message);
        }
        cb();
    });

    // 转换 atlas 为 JSON（仅当Java可用时执行，因为依赖buildAtlas的输出）
    gulp.task("imgres.atlasToJson", cb => {
        try {
            atlasToJson.convert("../res_built/atlas");
        } catch (err) {
            console.warn(" atlas to JSON conversion failed:", err.message);
        }
        cb();
    });

    // 复制 atlas 到目标目录（仅当Java可用时执行）
    gulp.task("imgres.atlas", () => {
        return gulp.src(["../res_built/atlas/*.png"]).pipe(gulp.dest(resourcesDestFolder));
    });

    // 优化并复制 atlas（仅当Java可用时执行）
    gulp.task("imgres.atlasOptimized", () => {
        return gulp
            .src(["../res_built/atlas/*.png"])
            .pipe(
                $.if(
                    fname => fileMustBeLossless(fname.history[0]),
                    $.imagemin(minifyImagesOptsLossless()),
                    $.imagemin(minifyImagesOpts())
                )
            )
            .pipe(gulp.dest(resourcesDestFolder));
    });

    //////////////////// 不依赖Java的资源任务 //////////////////////

    // 复制非图像资源
    gulp.task("imgres.copyNonImageResources", () => {
        return gulp.src(nonImageResourcesGlobs).pipe(gulp.dest(resourcesDestFolder));
    });

    // 复制图像资源
    gulp.task("imgres.copyImageResources", () => {
        return gulp
            .src(imageResourcesGlobs)
            .pipe($.cached("imgres.copyImageResources"))
            .pipe(gulp.dest(path.join(resourcesDestFolder)));
    });

    // 优化并复制图像资源
    gulp.task("imgres.copyImageResourcesOptimized", () => {
        return gulp
            .src(imageResourcesGlobs)
            .pipe(
                $.if(
                    fname => fileMustBeLossless(fname.history[0]),
                    $.imagemin(minifyImagesOptsLossless()),
                    $.imagemin(minifyImagesOpts())
                )
            )
            .pipe(gulp.dest(path.join(resourcesDestFolder)));
    });

    // 清理未使用的图像资源
    gulp.task("imgres.cleanupUnusedCssInlineImages", () => {
        return gulp
            .src(
                [
                    path.join(buildFolder, "res", "ui", "**", "*.png"),
                    path.join(buildFolder, "res", "ui", "**", "*.jpg"),
                    path.join(buildFolder, "res", "ui", "**", "*.svg"),
                    path.join(buildFolder, "res", "ui", "**", "*.gif"),
                ],
                { read: false }
            )
            .pipe($.if(fname => fname.history[0].indexOf("noinline") < 0, $.clean({ force: true })));
    });

    // 所有优化任务（根据Java可用性动态调整）
    gulp.task(
        "imgres.allOptimized",
        gulp.parallel(
            // 始终执行非依赖Java的任务
            "imgres.copyNonImageResources",
            "imgres.copyImageResourcesOptimized",
            // 仅当Java可用时才执行以下任务
            ...(isJavaAvailable
                ? ["imgres.buildAtlas", "imgres.atlasToJson", "imgres.atlasOptimized"]
                : [])
        )
    );
}

module.exports = {
    rawImageResourcesGlobs,
    nonImageResourcesGlobs,
    imageResourcesGlobs,
    gulptasksImageResources,
};
