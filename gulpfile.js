var gulp = require('gulp'),
    uglify = require('gulp-uglify'),
    concat = require('gulp-concat');

var sources = [
            'bower_components/rlite/rlite.js',
            'bower_components/cookie-monster/dist/cookie-monster.js',
            'src/ikon.js'
        ];

gulp.task('build', function() {
    return gulp.src(sources)
        .pipe(concat('ikon.js'))
        .pipe(gulp.dest('dist/'))
});

gulp.task('build-min', function() {
    return gulp.src(sources)
        .pipe(concat('ikon.min.js'))
        .pipe(uglify())
        .pipe(gulp.dest('dist/'))
});

gulp.task('default', ['build', 'build-min'], function() {
    gulp.watch('src/*.js', ['build', 'build-min']);
});
