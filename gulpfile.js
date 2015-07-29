var gulp = require('gulp');
var svg_to_png = require('svg-to-png');
var through = require('through2');
var flatten = require('lodash.flatten');
var path = require('path');
var async = require('async');
var fs = require('fs-extra');
var del = require('del');
var jade = require('gulp-jade');
var webserver = require('gulp-webserver');
var rename = require('gulp-rename');
var shell = require('gulp-shell');
var im = require('imagemagick');

var SIZES = {
  'Favicon, List views, Spotlight Searches': 16,
  'Finder': 32,
  'Dock and Finder Previews': 128,
  'Finder Preview': 256,
  'CoverFlow': 512
};

function createPNGs(SIZES) {
  return through.obj(function(file, enc, callback) {
    // Pass file through if:
    // - file has no contents
    // - file is a directory
    if (file.isNull() || file.isDirectory()) {
      this.push(file);
      return callback();
    }
    // Skip anything that's accidentally not an SVG
    if (['.svg'].indexOf(path.extname(file.path)) === -1) {
      this.push(file);
      return callback();
    }
    var self = this;
    var src = file.path;
    var basename = path.basename(file.path).split('.')[0];

    var pngTasks = flatten(Object.keys(SIZES).map(function(name) {
      var s = [];
      var px = SIZES[name];
      var dest = './dist/' + basename + '_' + px + 'x' + px + '-tmp';
      var dest_retina = './dist/' + basename + '_' + px + 'x' + px + '@2x-tmp';

      s.push(function(cb) {
        console.log('Generating %s %dx%d...', name, px, px);
        svg_to_png.convert(src, dest, {
          defaultHeight: px,
          defaultWidth: px
        }).then(function() {
          fs.move(dest + '/' + basename + '.png', dest.replace('-tmp', '.png'), function() {
            console.log('completed ', name);
            cb();
          });
        });
      });

      s.push(function(cb) {
        console.log('Generating %s retina %dx%d...', name, px * 2, px * 2);
        svg_to_png.convert(src, dest_retina, {
          defaultHeight: px * 2,
          defaultWidth: px * 2
        }).then(function() {
          fs.move(dest_retina + '/' + basename + '.png', dest_retina.replace('-tmp', '.png'), function() {
            console.log('completed ', name + ' (Retina)');
            cb();
          });
        });
      });
      return s;
    }));

    console.log('running %d pngTasks...', pngTasks.length);
    async.series(pngTasks, function() {
      del('dist/*-tmp', function() {
        self.push(file);
        return callback();
      });
    });
  });
}

gulp.task('png', function() {
  gulp.src('./mongodb-leaf.svg')
    .pipe(createPNGs(SIZES))
    .pipe(gulp.dest('./dist'));
});

gulp.task('html', function() {
  gulp.src('./index.jade')
    .pipe(jade({
      locals: {
        sizes: SIZES
      }
    }))
    .pipe(gulp.dest('./dist'));
});

gulp.task('ico', function(cb) {
  im.convert(['dist/mongodb-leaf_16x16.png',
    '-gravity', 'center',
    '-background', 'transparent',
    '-crop', '16x16+0+0',
    '-colors', '256',
    '-flatten',
    'dist/mongodb-leaf.ico'
  ], cb);
});

gulp.task('iconset:copy', function() {
  return gulp.src('dist/*.png')
    .pipe(rename(function(p) {
      p.basename = p.basename.replace('mongodb-leaf', 'icon');
    }))
    .pipe(gulp.dest('dist/mongodb-leaf.iconset'));
});

gulp.task('iconset', ['iconset:copy'], shell.task('iconutil -c icns dist/mongodb-leaf.iconset'));

gulp.task('webserver', function() {
  gulp.src('dist/')
    .pipe(webserver({
      livereload: true,
      directoryListing: false,
      open: true
    }));
});

gulp.task('markdown', function() {
  console.log('## Sizes');

  Object.keys(SIZES).map(function(name) {
    var px = SIZES[name];

    console.log('### ' + px + 'x' + px);
    console.log('> ' + name);
    console.log();
    console.log('![](dist/mongodb-leaf_%sx%s.png)', px, px);
    console.log();
  });

  console.log('## Retina');

  Object.keys(SIZES).map(function(name) {
    var px = SIZES[name];

    console.log('### ' + px + 'x' + px);
    console.log();
    console.log('![](dist/mongodb-leaf_%sx%s@2x.png)', px, px);
    console.log();
  });
});

gulp.task('build', ['png', 'after-png']);

gulp.task('after-png', ['png', 'html', 'ico', 'iconset']);

gulp.task('start', ['html', 'webserver'], function() {
  gulp.watch('index.jade', ['html']);
});
