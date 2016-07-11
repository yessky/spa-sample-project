# spa-sample-project

## 1. 准备开发环境

### 1.1. 安装工具

安装nodejs: 项目中使用到了gulp, sass, svgstore等工具

安装nginx: 项目中使用nginx转发代理后端接口

安装gulp: npm install -g gulp-cli

### 1.2. 安装依赖

准备好以上工具之后，执行`npm install`开始安装项目依赖

### 1.3. 配置本地nginx

配置好本地nginx

注意修改`root`指向本机对应的目录， 端口号自行根据实际情况配置

```
假设项目位于本机 /User/yourname/spa-sample-project 目录

则开发环境对应的nginx root为  /User/yourname/spa-sample-project/dev

则发布环境对应的nginx root为  /User/yourname/spa-sample-project/release
```

等待完成以上步骤后，命令行 `gulp` 则将启动开发环境，自动启动浏览器

## 2. 目录及资源结构

### 2.1. 项目结构

```
src 源码目录（无法直接运行）

dev 从源码构建（预处理后，未压缩，未合并，未加cacheboost）的可运行的源代码

release 已构建好的线上版本（代码经过压缩/合并/优化/cacheboost）

gulpfile.js gulp任务配置文件

kspack.profile.js 线上构建任务的配置文件

kspack.js cmd模块及资源打包模块（用法见gulpfile.js@kspack任务）

*.tpl 项目及项目业务的一些配置文件模板（配置文件需要gulp启动时动态生成）
```

### 2.2. 源码结构（目录即package）

```
slices/icons svg图标切片

slices/images png图标切片

images 公用图片(切片合并之后的文件将输出到此目录)

vendor 三方库资源(可能是html/js/css)

base 核心库

ui 基础ui库

app 项目实际业务的资源

其中 app/ui目录下的views/styles分别存放模版及样式源文件

可根据实际场景自行添加/修改目录
```

### 2.3. 主要模块介绍

```
base/k.js CMD风格的loader

base/Widget.js 所有UI组件的基类（通常情况下UI组件实现必须继承该模块，除非非常了解base/_Widget*.js, base/_Template*.js）

base/dom.js dom操作库（一个能够jquery/zepto相关方法中间代理模块）

base/aspect.js AOP变成实现，可以在方法之前之后之间切入

base/on.js 事件绑定模块

base/lang.js 语言shim/辅助方法库（继承并扩展underscore）

base/declare.js oop模块

base/parser.js 模版指令解析模块

base/topic.js 发布订阅模式实现模块

app/app.js 项目入口

app/common.js 包含项目公用的辅助方法

app/routes.js 负责项目前端路由管理(路由的具体实现在base/router.js，从backbone中分离得到该模块)

app/medias.js 负责项目全局的音频/视频播放控制

app/ajax.js 负责项目ajax交互（对zepto/jquery的ajax方法的再一次封装）

app/services.js 统一负责项目与后端进行数据交互通信（获取数据，提交数据）

app/entry.*.js 对应路由的入口文件，路由与入口映射规则详见app/routes.js

```

关于loader（https://github.com/yessky/loader loader实现同requirejs的commonjs模式一致）以及模块如果定义加载，可以参考requirejs文档

## 3. 打包与发布

打包模块通过配置文件指定一系列的项目入口，实现了依赖自动递归扫描，依赖优先级排序，按需合并，优化按需加载模块，缓存管理等功能

配置选项说明具体见kspack.profile.js中的注释内容

将release目录中的资源添加到zip包中，上传至服务器根目录解压替换即可

如果不停机部署应注意，资源应分为两部分进行

```
step 1: 将所有除index.html外的文件覆盖发布到所有机器上（直接覆盖，由于文件存在md5指纹，不用担心发布过程中资源出现404错误）

step 2: 替换所有机器上的index.html文件
```

## 4. 编码与开发规范

资源存放应按照前文所示进行存放

html/css代码规范(sass模块尽可能按模块使用嵌套在一个block中，防止优先级命名等冲突) http://codeguide.bootcss.com/

js代码规范基本遵循(其中空格，缩进必须严格按规范呢书写) http://contribute.jquery.org/style-guide/js/

## 5. 其他

关于`git gulp sass cmd-loader nginx`等的安装/使用/配置请自行查看项目已有代码，或者通过google/百度/stackoverflow/github自行查找相关文档及解决方案, 亦可联系本人

email: admin@veryos.com

qq: 441548727

github: yessky

## 6. 案例

<a href="http://m.music.migu.cn" target="_blank">咪咕音乐触屏版</a>

## License

NOTE: 使用请保留示例文件、代码中的版权信息

`kspack` is available under the terms of the <a href="https://github.com/yessky/spa-sample-project/blob/master/LICENSE.md">MIT License.</a>