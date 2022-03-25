// ==UserScript==
// @name         manwa图片下载
// @namespace    https://github.com/coofo/someScript
// @version      0.0.4
// @license      AGPL License
// @description  下载
// @author       coofo
// @downloadURL  https://github.com/coofo/someScript/raw/main/tampermonkey/manwa.user.js
// @supportURL   https://github.com/coofo/someScript/issues
// @include      /^https://manwa.me/book/\d+/
// @require      https://cdn.bootcss.com/jszip/3.1.5/jszip.min.js
// @require      https://greasyfork.org/scripts/442002-coofoutils/code/coofoUtils.js?version=1031698
// @connect      img.manwa.me
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// ==/UserScript==


(function (tools) {
    'use strict';
    //setting
    let setting = tools.setting;
    /**
     * 文件名格式（包括路径）
     * ${bookId}        漫画ID
     * ${bookName}      漫画名
     * ${selectType}    water/adult
     * ${chapterId}     章节ID
     * ${chapterName}   章节名
     * ${index}         插图序号
     */
    setting.fileNameTemplate = "[manwa]/[${bookId}][${author}]${bookName}(${selectType})/[${chapterId}]${chapterName}/${index}";

    /**
     * zip文件名格式（包括路径）
     */
    setting.zipNameTemplate = "[manwa][${bookId}][${author}]${bookName}";

    /**
     * 下载线程数量
     * @type {number}
     */
    setting.threadNum = 5;
    /**
     * 下载模式
     * single：将图片文件单个下载（如果需要保存的文件有文件夹结构，则需要将tampermonkey下载模式调整为【浏览器API】）
     * zip：将图片打成zip包下载
     */
    setting.downloadMode = "zip";

    /**
     * 下载失败重试次数
     * @type {number}
     */
    setting.downloadRetryTimes = 2;

    /**
     * all：我全都要
     * water：清水优先
     * adult：完整优先
     */
    setting.selectType = "all";

    //setting end

    console.log(GM_info.downloadMode);

    //首页基础信息
    let url = window.location.href;
    let urlMatch = url.match(tools.manwa.regex.bookUrl);
    let baseInfo = {
        bookId: urlMatch[1],
        bookName: $("div.detail-main p.detail-main-info-title").html(),
        author: $("p.detail-main-info-author a.detail-main-info-value").html()
    };

    $("a.detail-bottom-btn").after('<a id="user_js_download" class="detail-bottom-btn">⬇下载</a>');

    let btn = $("#user_js_download");
    tools.runtime.downloadTask.showMsg = function (msg) {
        btn.html(msg);
    };
    btn.click(function () {
        if (tools.runtime.nowDownloading) return;
        tools.runtime.nowDownloading = true;


        if (tools.setting.downloadMode === "zip") {
            tools.runtime.downloadTask.zip = new JSZip();
        }

        let adultList = $("ul#adult-list-select li a.chapteritem");
        let waterList = $("ul#detail-list-select li a.chapteritem");
        let generateTask = coofoUtils.service.task.create();
        let downloadTask = coofoUtils.service.task.create();
        tools.runtime.downloadTask.generateTask = generateTask;
        tools.runtime.downloadTask.downloadTask = downloadTask;

        if (setting.selectType === "all" || setting.selectType === "adult" || waterList.length <= 0) {
            //完整
            let baseAdultInfo = Object.assign({
                selectType: "adult",
                downloadTask: downloadTask,
            }, baseInfo);

            for (let i = 0; i < adultList.length; i++) {
                let chapterId = $(adultList[i]).attr("href").match(/jmud\((\d+)\)/)[1];

                let info = Object.assign({
                    chapterId: chapterId
                }, baseAdultInfo);

                generateTask.api.addTask(tools.manwa.downloadHelp.generateTask, info, setting.downloadRetryTimes);
            }
        }

        if (setting.selectType === "all" || setting.selectType === "water" || adultList.length <= 0) {
            //清水
            let baseWaterInfo = Object.assign({
                selectType: "water",
                downloadTask: downloadTask,
            }, baseInfo);
            for (let i = 0; i < waterList.length; i++) {
                let chapterId = $(waterList[i]).attr("href").match(/jmud\((\d+)\)/)[1];

                let info = Object.assign({
                    chapterId: chapterId
                }, baseWaterInfo);

                generateTask.api.addTask(tools.manwa.downloadHelp.generateTask, info, setting.downloadRetryTimes);
            }
        }


        generateTask.runtime.callBack = function () {
            let list = generateTask.runtime.taskList;
            if (list.length <= 0) {
                tools.runtime.downloadTask.showMsg("下载目标为0");
                return;
            }
            downloadTask.runtime.callBack = function () {
                let list = downloadTask.runtime.taskList;
                let completeNum = 0;
                for (let i = 0; i < list.length; i++) {
                    if (list[i].complete === true) completeNum++;
                }

                if (tools.setting.downloadMode === "zip") {
                    tools.runtime.downloadTask.zip.generateAsync({type: "blob"}).then(function (content) {
                        let zipFileName = coofoUtils.commonUtils.format.string.byMap(tools.setting.zipNameTemplate, baseInfo) + ".zip";

                        coofoUtils.commonUtils.downloadHelp.toUser.asTagA4Blob(content, zipFileName);
                        tools.runtime.downloadTask.showFinished();
                    });
                }
                tools.runtime.downloadTask.showMsg("下载完成：" + completeNum);
            };

            for (let i = 0; i < setting.threadNum; i++) {
                downloadTask.api.exec(i);
            }
        };
        for (let i = 0; i < setting.threadNum; i++) {
            generateTask.api.exec(i);
        }
    });


    // span.before('<span class="BtnBase UserInfoCmdFollow UserInfoCmdFollow_581115" style="margin-right: 10px;"  id="span_download_test">⬇下载测试</span>');
    // $("#span_download_test").click(function () {
    // });


})((function () {
    const constants = {};
    const cache = {};

    const tools = {
        setting: {pass: ""},
        runtime: {
            nowDownloading: false,
            downloadTask: {
                zip: null,
                generateTask: null,
                getGeneratedNum: function () {
                    if (this.generateTask == null) {
                        return 0;
                    }
                    let i = 0;
                    let list = this.generateTask.runtime.taskList;
                    for (let j = 0; j < list.length; j++) {
                        if (list[j].complete === true) {
                            i++;
                        }
                    }
                    return i;
                },
                downloadTask: null,
                getDownloadedNum: function () {
                    if (this.downloadTask == null) {
                        return 0;
                    }
                    let i = 0;
                    let list = this.downloadTask.runtime.taskList;
                    for (let j = 0; j < list.length; j++) {
                        if (list[j].complete === true) {
                            i++;
                        }
                    }
                    return i;
                },
                showMsg: function (msg) {
                    console.log(msg);
                },
                refreshGenerateStatus: function () {
                    let completeNum = tools.runtime.downloadTask.getGeneratedNum();
                    let totalNum = tools.runtime.downloadTask.generateTask.runtime.taskList.length;
                    let digitNum;
                    if(totalNum > 1000){
                        digitNum = 2;
                    }else if(totalNum > 100){
                        digitNum = 1;
                    }else {
                        digitNum = 0;
                    }
                    let percent = coofoUtils.commonUtils.format.num.toThousands(completeNum / totalNum * 100, null, digitNum) + "%";
                    tools.runtime.downloadTask.showMsg("解析地址 " + percent);
                },
                refreshDownLoadStatus: function () {
                    let completeNum = tools.runtime.downloadTask.getDownloadedNum();
                    let totalNum = tools.runtime.downloadTask.downloadTask.runtime.taskList.length;
                    let digitNum;
                    if(totalNum > 1000){
                        digitNum = 2;
                    }else if(totalNum > 100){
                        digitNum = 1;
                    }else {
                        digitNum = 0;
                    }
                    let percent = coofoUtils.commonUtils.format.num.toThousands(completeNum / totalNum * 100, null, digitNum) + "%";
                    tools.runtime.downloadTask.showMsg("下载 " + percent);
                },
                showFinished: function () {
                    this.showMsg("下载完成：" + tools.runtime.downloadTask.getDownloadedNum());
                    tools.runtime.downloadTask.generateTask = null;
                    tools.runtime.downloadTask.downloadTask = null;
                }
            }
        },


        manwa: {
            regex: {
                bookUrl: /^https:\/\/manwa.me\/book\/(\d+)/,
                archiveUrl: /^https:\/\/healthywawa.com\/archives\/(\d+)/,
                dataUrl: /^https:\/\/manwa.me\/forInject\/(\d+).html/
            },
            utils: {
                isBookPage: function () {
                    let url = window.location.href;
                    return url.match(tools.manwa.regex.bookUrl) != null;
                },
            },
            api: {
                getImgUrl: function (chapterId, onSuccess, onError, onComplete) {
                    $.ajax({
                        // url: "https://manwa.me/forInject/653939.html?f=fozcRotntz13bQBoXcsulA==",
                        url: `https://manwa.me/forInject/${chapterId}.html`,
                        type: 'get',
                        contentType: "text/html; charset=utf-8",
                        success: function (request) {
                            // console.log(request);

                            let div = document.createElement("div");
                            div.innerHTML = request;
                            let imgUrls = [];
                            let divSelector = $(div);
                            let imgs = divSelector.find("div.view-main-1 img");
                            for (let i = 0; i < imgs.length; i++) {
                                imgUrls[i] = $(imgs[i]).attr("data-original");
                            }
                            // if (imgUrls.length <= 0) {
                            //     tools.manwa.utils.tagZeroImgItem(uid, iid);
                            // }

                            let info = {
                                // bookId: divSelector.find("div.view-fix-top-bar-right a").attr("href").match(tools.manwa.regex.bookUrl)[1],
                                // bookName: divSelector.find("div.view-fix-top-bar-center-right-book-name").html().trim(),
                                chapterId: chapterId,
                                chapterName: divSelector.find("div.view-fix-top-bar-center-right-chapter-name").html().trim(),
                            };
                            onSuccess(imgUrls, info);
                        },
                        error: onError,
                        complete: onComplete
                    });
                },
            },
            downloadHelp: {
                generateTask: function (taskInfo, taskItem) {
                    tools.manwa.api.getImgUrl(taskInfo.chapterId, function (imgUrls, info) {

                        for (let j = 0; j < imgUrls.length; j++) {
                            let imgUrl = imgUrls[j];

                            let suffix = coofoUtils.commonUtils.format.file.getSuffix(imgUrl);
                            if (suffix.length > 0) {
                                suffix = "." + suffix;
                            }
                            let index = j + 1;
                            let infoEx = Object.assign({
                                imgUrl: imgUrl,
                                index: coofoUtils.commonUtils.format.num.fullNum(index, 3),
                                suffix: suffix
                            }, info, taskInfo);

                            let downloadFunction;
                            if (tools.setting.downloadMode === "single") {
                                downloadFunction = tools.manwa.downloadHelp.singleDownloadTask;
                            } else {
                                downloadFunction = tools.manwa.downloadHelp.zipDownloadTask;
                            }
                            taskInfo.downloadTask.api.addTask(downloadFunction, infoEx, tools.setting.downloadRetryTimes);
                        }

                        taskItem.success();
                        tools.runtime.downloadTask.refreshGenerateStatus();
                    }, function () {
                        taskItem.failed();
                    });
                },
                singleDownloadTask: function (taskInfo, taskItem) {
                    let url = coofoUtils.commonUtils.format.url.fullUrl(taskInfo.imgUrl);
                    let fileName = tools.manwa.downloadHelp.fileNameService.getFileName(taskInfo);
                    coofoUtils.tampermonkeyUtils.downloadHelp.toUser.asGMdownload(taskInfo.imgUrl, fileName, {
                        gmDownload: {
                            saveAs: false,
                            onload: function () {
                                taskItem.success();
                                tools.runtime.downloadTask.refreshDownLoadStatus();
                            },
                            onerror: function (e) {
                                console.error("GM_download error: " + url);
                                console.error(e);
                                taskItem.failed();
                            },
                            ontimeout: function (e) {
                                console.error("GM_download timeout");
                                console.error(e);
                                taskItem.failed();
                            }
                        }
                    });
                },
                zipDownloadTask: function (taskInfo, taskItem) {
                    let url = coofoUtils.commonUtils.format.url.fullUrl(taskInfo.imgUrl);
                    let fileName = tools.manwa.downloadHelp.fileNameService.getFileName(taskInfo);
                    coofoUtils.tampermonkeyUtils.downloadHelp.toBlob.asBlob(url, function (responseDetails) {
                        if (responseDetails.status === 200) {
                            tools.runtime.downloadTask.zip.file(fileName, responseDetails.response);
                            taskItem.success();
                            tools.runtime.downloadTask.refreshDownLoadStatus();
                        } else {
                            console.error("download error: " + url);
                            console.error(responseDetails);
                            taskItem.failed();
                        }
                    })
                },
                fileNameService: {
                    getFileName: function (downloadTaskInfo) {
                        let setting = tools.setting;
                        return coofoUtils.commonUtils.format.string.byMap(setting.fileNameTemplate, downloadTaskInfo) + downloadTaskInfo.suffix;
                    }
                },


            }
        }
    };

    return tools;
})());