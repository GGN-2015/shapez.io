const path = require("path");
const audiosprite = require("gulp-audiosprite");
// 引入必要的模块
const { execSync } = require('child_process');

// 辅助函数：检查ffmpeg是否可用
function isFfmpegAvailable() {
    try {
        // 执行ffmpeg版本命令，成功则表示存在
        execSync('ffmpeg -version', { stdio: 'ignore' });
        return true;
    } catch (err) {
        // 命令执行失败（找不到命令或其他错误），表示ffmpeg不存在
        console.warn('ffmpeg not found - skipping sounds.sfxGenerateSprites task');
        return false;
    }
}

function gulptasksSounds($, gulp, buildFolder) {
    // Gather some basic infos
    const soundsDir = path.join(__dirname, "..", "res_raw", "sounds");
    const builtSoundsDir = path.join(__dirname, "..", "res_built", "sounds");

    gulp.task("sounds.clear", () => {
        return gulp.src(builtSoundsDir, { read: false, allowEmpty: true }).pipe($.clean({ force: true }));
    });

    const filters = ["volume=0.2"];

    const fileCache = new $.cache.Cache({
        cacheDirName: "shapezio-precompiled-sounds",
    });

    function getFileCacheValue(file) {
        const { _isVinyl, base, cwd, contents, history, stat, path } = file;
        const encodedContents = Buffer.from(contents).toString("base64");
        return { _isVinyl, base, cwd, contents: encodedContents, history, stat, path };
    }

    // Encodes the game music
    // gulp.task("sounds.music", () => {
    //     return gulp
    //         .src([path.join(soundsDir, "music", "**", "*.wav"), path.join(soundsDir, "music", "**", "*.mp3")])
    //         .pipe($.plumber())
    //         .pipe(
    //             $.cache(
    //                 $.fluentFfmpeg("mp3", function (cmd) {
    //                     return cmd
    //                         .audioBitrate(48)
    //                         .audioChannels(1)
    //                         .audioFrequency(22050)
    //                         .audioCodec("libmp3lame")
    //                         .audioFilters(["volume=0.15"]);
    //                 }),
    //                 {
    //                     name: "music",
    //                     fileCache,
    //                     value: getFileCacheValue,
    //                 }
    //             )
    //         )
    //         .pipe(gulp.dest(path.join(builtSoundsDir, "music")));
    // });
    const through2 = require('through2');

    gulp.task("sounds.music", () => {
        return gulp
            .src([
                path.join(soundsDir, "music", "**", "*.wav"),
                path.join(soundsDir, "music", "**", "*.mp3")
            ])
            .pipe($.plumber()) // 保留错误处理
            .pipe(
                $.cache(
                    // 使用through2创建一个空操作流，兼容gulp-cache的接口要求
                    through2.obj(function(file, enc, callback) {
                        // 不做任何处理，直接传递文件
                        this.push(file);
                        callback();
                    }),
                    {
                        name: "music",
                        fileCache,
                        value: getFileCacheValue,
                    }
                )
            )
            .pipe(gulp.dest(path.join(builtSoundsDir, "music")));
    });

    // Encodes the game music in high quality for the standalone
    gulp.task("sounds.musicHQ", () => {
        return gulp
            .src([path.join(soundsDir, "music", "**", "*.wav"), path.join(soundsDir, "music", "**", "*.mp3")])
            .pipe($.plumber())
            .pipe(
                $.cache(
                    $.fluentFfmpeg("mp3", function (cmd) {
                        return cmd
                            .audioBitrate(256)
                            .audioChannels(2)
                            .audioFrequency(44100)
                            .audioCodec("libmp3lame")
                            .audioFilters(["volume=0.15"]);
                    }),
                    {
                        name: "music-high-quality",
                        fileCache,
                        value: getFileCacheValue,
                    }
                )
            )
            .pipe(gulp.dest(path.join(builtSoundsDir, "music")));
    });

    // Encodes the ui sounds
    gulp.task("sounds.sfxGenerateSprites", (cb) => { // 1. 接收 cb 回调参数（关键）
        // 2. ffmpeg 不存在时，直接调用 cb() 结束任务
        if (!isFfmpegAvailable()) {
            cb(); // 无参数表示任务「成功跳过」，不触发错误
            return; // 终止后续逻辑
        }

        // 3. ffmpeg 存在时，正常执行原流任务逻辑
        return gulp
            .src([
                path.join(soundsDir, "sfx", "**", "*.wav"),
                path.join(soundsDir, "sfx", "**", "*.mp3")
            ])
            .pipe($.plumber()) // 捕获流中的错误，避免任务中断
            .pipe(
                audiosprite({
                    format: "howler",
                    output: "sfx",
                    gap: 0.1,
                    export: "mp3",
                })
            )
            .pipe(gulp.dest(path.join(builtSoundsDir)))
            // 4. 流任务完成后调用 cb()（可选，流结束即任务完成，也可省略）
            .on('end', cb);
    });
    //
    // something is wrong with sounds.sfxOptimize, skip it.
    // we replace it with a gulp script without any operation
    //
    // gulp.task("sounds.sfxOptimize", () => {
    //     return gulp
    //         .src([path.join(builtSoundsDir, "sfx.mp3")])
    //         .pipe($.plumber())
    //         .pipe(
    //             $.fluentFfmpeg("mp3", function (cmd) {
    //                 return cmd
    //                     .audioBitrate(128)
    //                     .audioChannels(1)
    //                     .audioFrequency(22050)
    //                     .audioCodec("libmp3lame")
    //                     .audioFilters(filters);
    //             })
    //         )
    //         .pipe(gulp.dest(path.join(builtSoundsDir)));
    // });
    //
    gulp.task("sounds.sfxOptimize", () => {
        return gulp
            .src([path.join(builtSoundsDir, "sfx.mp3")])
            .pipe($.plumber())
            .pipe(gulp.dest(path.join(builtSoundsDir)));
    });

    gulp.task("sounds.sfxCopyAtlas", () => {
        return gulp
            .src([path.join(builtSoundsDir, "sfx.json")])
            .pipe(gulp.dest(path.join(__dirname, "..", "src", "js", "built-temp")));
    });

    gulp.task(
        "sounds.sfx",
        gulp.series("sounds.sfxGenerateSprites", "sounds.sfxOptimize", "sounds.sfxCopyAtlas")
    );

    gulp.task("sounds.copy", () => {
        return gulp
            .src(path.join(builtSoundsDir, "**", "*.mp3"))
            .pipe($.plumber())
            .pipe(gulp.dest(path.join(buildFolder, "res", "sounds")));
    });

    gulp.task("sounds.buildall", gulp.parallel("sounds.music", "sounds.sfx"));
    gulp.task("sounds.buildallHQ", gulp.parallel("sounds.musicHQ", "sounds.sfx"));

    gulp.task("sounds.fullbuild", gulp.series("sounds.clear", "sounds.buildall", "sounds.copy"));
    gulp.task("sounds.fullbuildHQ", gulp.series("sounds.clear", "sounds.buildallHQ", "sounds.copy"));
    gulp.task("sounds.dev", gulp.series("sounds.buildall", "sounds.copy"));
}

module.exports = {
    gulptasksSounds,
};
