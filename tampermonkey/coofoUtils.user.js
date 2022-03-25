// ==UserScript==
// @name         coofoUtils
// @namespace    https://github.com/coofo/someScript
// @version      0.0.3
// @license      MIT License
// @description  一些工具
// @author       coofo
// @downloadURL  https://github.com/coofo/someScript/raw/main/tampermonkey/coofoUtils.user.js
// @supportURL   https://github.com/coofo/someScript/issues
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function () {
    'use strict';
    window.coofoUtils = {
        commonUtils: {
            format: {
                num: {
                    fullNum: function (num, length) {
                        return (Array(length).join('0') + num).slice(-length);
                    },
                    toThousands: function (value, seperator, digitNum) {
                        if ((value = ((value = value + "").replace(/^\s*|\s*$|,*/g, ''))).match(/^\d*\.?\d*$/) == null)
                            return value;
                        value = digitNum >= 0 ? (Number(value).toFixed(digitNum) + "") : value;
                        let r = [],
                            tl = value.split(".")[0],
                            tr = value.split(".")[1];
                        tr = typeof tr !== "undefined" ? tr : "";
                        if (seperator != null && seperator !== "") {
                            while (tl.length >= 3) {
                                r.push(tl.substring(tl.length - 3));
                                tl = tl.substring(0, tl.length - 3);
                            }
                            if (tl.length > 0)
                                r.push(tl);
                            r.reverse();
                            r = r.join(seperator);
                            return tr === "" ? r : r + "." + tr;
                        }
                        return value;
                    }
                },
                file: {
                    getSuffix: function (name) {
                        let index = name.lastIndexOf('.');
                        if (index < 0) {
                            return "";
                        } else {
                            return name.substring(index + 1);
                        }
                    }
                },
                string: {
                    byMap: function (str, map, preprocessing) {
                        let reg = new RegExp('\\${([a-z][a-zA-Z0-9_.]+)}', 'g');
                        return str.replace(reg, function (match, pos, originalText) {
                            let key = match.replace(reg, '$1');
                            let value = map[key];
                            if (value === null || value === undefined) {
                                value = match;
                            }
                            if (typeof preprocessing === "function") {
                                value = preprocessing(value);
                            }
                            return value;
                        });
                    }
                },
                url: {
                    fullUrl: function (url) {
                        if (url.match(/^[a-zA-Z0-9]+:\/\//) !== null) {
                            return url;
                        } else if (url.match(/^\/\/[a-zA-Z0-9]+/) !== null) {
                            return window.location.protocol + url;
                        } else if (url.match(/^\/[a-zA-Z0-9]+/) !== null) {
                            return window.location.origin + url;
                        } else {
                            return url;
                        }
                    }
                }
            },
            assert: {
                isTrue: function (value, message) {
                    if (true !== value) {
                        console.error(message);
                        console.error(value);
                        throw message;
                    }
                },
                isNull: function (value, message) {
                    if (value !== null) {
                        console.error(message);
                        console.error(value);
                        throw message;
                    }
                },
                notNull: function (value, message) {
                    if (value === null) {
                        console.error(message);
                        console.error(value);
                        throw message;
                    }
                },
                hasLength: function (value, message) {
                    if (!(value !== null && value.length > 0)) {
                        console.error(message);
                        console.error(value);
                        throw message;
                    }
                },
            },
            downloadHelp: {
                toBlob: {},
                toUser: {
                    asTagA4Url: function (url, fileName) {
                        let aLink = document.createElement('a');
                        if (fileName) {
                            aLink.download = fileName;
                        } else {
                            aLink.download = url.substring(url.lastIndexOf('/') + 1);
                        }
                        aLink.className = 'download-temp-node';
                        aLink.target = "_blank";
                        aLink.style = "display:none;";
                        aLink.href = url;
                        document.body.appendChild(aLink);
                        if (document.all) {
                            aLink.click(); //IE
                        } else {
                            let evt = document.createEvent("MouseEvents");
                            evt.initEvent("click", true, true);
                            aLink.dispatchEvent(evt); // 其它浏览器
                        }
                        document.body.removeChild(aLink);
                    },
                    asTagA4Blob: function (content, fileName) {
                        if ('msSaveOrOpenBlob' in navigator) {
                            navigator.msSaveOrOpenBlob(content, fileName);
                        } else {
                            let aLink = document.createElement('a');
                            aLink.className = 'download-temp-node';
                            aLink.download = fileName;
                            aLink.style = "display:none;";
                            let blob = new Blob([content], {type: content.type});
                            aLink.href = window.URL.createObjectURL(blob);
                            document.body.appendChild(aLink);
                            if (document.all) {
                                aLink.click(); //IE
                            } else {
                                let evt = document.createEvent("MouseEvents");
                                evt.initEvent("click", true, true);
                                aLink.dispatchEvent(evt); // 其它浏览器
                            }
                            window.URL.revokeObjectURL(aLink.href);
                            document.body.removeChild(aLink);
                        }
                    }
                }
            }
        },
        tampermonkeyUtils: {
            downloadHelp: {
                toBlob: {
                    asBlob: function (url, onSuccess) {
                        GM_xmlhttpRequest({
                            method: "GET",
                            url: url,
                            responseType: "arraybuffer",
                            onload: function (responseDetails) {
                                onSuccess(responseDetails);
                            }
                        });
                    }
                },
                toUser: {
                    asGMdownload: function (url, fileName, setting) {
                        let details;
                        if (typeof setting === "object" && typeof setting.gmDownload === "object") {
                            details = setting.gmDownload;
                        } else {
                            details = {saveAs: false};
                        }
                        details.url = url;
                        details.name = fileName;
                        // console.log(details.url);
                        // console.log(details.name);
                        GM_download(details);
                    }
                }
            }
        },
        service: {
            task: {
                create: function (callBack) {
                    let task = {
                        runtime: {taskList: [], callBack: callBack},
                        api: {
                            getRuntime: function () {
                                return this.runtime;
                            },
                            addTask: function (exec, taskInfo, lastRetryTimes) {
                                let taskItem = {
                                    taskInfo: taskInfo,
                                    handler: null,
                                    complete: false,
                                    lastFinishTime: 0,
                                    lastRetryTimes: lastRetryTimes + 1,
                                    exec: function (onTaskFinish) {
                                        this.onTaskFinish = onTaskFinish;
                                        exec(this.taskInfo, this);
                                    },
                                    success: function () {
                                        this.handler = null;
                                        this.complete = true;
                                        this.lastFinishTime = Date.now();
                                        this.onTaskFinish();

                                    },
                                    failed: function () {
                                        this.handler = null;
                                        this.lastRetryTimes--;
                                        this.lastFinishTime = Date.now();
                                        this.onTaskFinish();
                                    },
                                    onTaskFinish: null
                                };
                                task.runtime.taskList.push(taskItem);
                            },
                            exec: function (handler) {
                                let taskList = task.runtime.taskList;
                                //判断该执行器是否有未完任务，并指定为失败
                                for (let i = 0; i < taskList.length; i++) {
                                    let taskItem = taskList[i];
                                    if (taskItem.handler === handler) {
                                        taskItem.failed();
                                    }
                                }

                                //寻找新任务并标记返回
                                let allFinished = true;
                                for (let i = 0; i < taskList.length; i++) {
                                    let taskItem = taskList[i];

                                    if (taskItem.complete === false && taskItem.lastRetryTimes > 0) {
                                        if (taskItem.handler == null) {
                                            taskItem.handler = handler;
                                            setTimeout(function () {
                                                taskItem.exec(function () {
                                                    task.api.exec(handler);
                                                });
                                            }, 0);
                                            return;
                                        } else {
                                            allFinished = false;
                                        }
                                    }
                                }
                                if (allFinished) task.runtime.callBack();
                            },

                        }
                    };
                    return task;
                }
            }
        }
    };
})();