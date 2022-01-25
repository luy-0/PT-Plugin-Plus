/**
 * @see https://global.download.synology.com/download/Document/DeveloperGuide/Synology_Download_Station_Web_API.pdf
 * @backport https://github.com/ronggang/PT-Plugin-Plus/blob/48c2d42a1d05c129c0abbbecf653b1b7d88a8a8e/src/resource/btClients/src/clients/synologyDownloadStation.ts
 */
(function ($, window) {
  class Client {

    init(options) {
      this.options = options;
      this.sessionId = "";
      if (this.options.address.substr(-1) == "/") {
        this.options.address = this.options.address.substr(0, this.options.address.length - 1);
      }
    }

    /**
     * 获取 SID
     */
    getSessionId() {
      return new Promise((resolve, reject) => {
        let url = `${this.options.address}/webapi/auth.cgi?api=SYNO.API.Auth&version=3&method=login&account=${encodeURIComponent(this.options.loginName)}&passwd=${encodeURIComponent(this.options.loginPwd)}&session=DownloadStation&format=sid`;
        $.ajax({
          url,
          timeout: PTBackgroundService.options.connectClientTimeout,
          dataType: "json"
        }).done((result) => {
          console.log(result)
          if (result && result.success) {
            this.sessionId = result.data.sid;
            resolve(this.sessionId)
          } else {
            reject({
              status: "error",
              code: result.error.code,
              msg: i18n.t("downloadClient.permissionDenied") //"身份验证失败"
            })
          }
          /**
            400 No such account or incorrect password
            401 Account disabled
            402 Permission denied
            403 2-step verification code required
            404 Failed to authenticate 2-step verification code
           */

        }).fail(() => {
          reject()
        })
      })
    }

    /**
     * 执行指定的操作
     * @param {*} action 需要执行的执令
     * @param {*} data 附加数据
     * @return Promise
     */
    call(action, data) {
      console.log("synologyDownloadStation.call", action, data);
      return new Promise((resolve, reject) => {
        switch (action) {
          case "addTorrentFromURL":
            this.addTorrentFromUrl(data, (result) => {
              if (result && result.success) {
                resolve(result);
              } else {
                reject(result)
              }
            });
            break;

            // 测试是否可连接
          case "testClientConnectivity":
            this.getSessionId().then(result => {
              resolve(result != "");
            }).catch(result => {
              reject(result);
            })
            break;
        }
      });
    }

    /**
     * 添加种子链接
     * @param {*} options
     * @param {*} callback
     */
    addTorrentFromUrl(options, callback) {
      if (!this.sessionId) {
        this.getSessionId().then((result) => {
          if (result) {
            this.addTorrentFromUrl(options, callback)
          } else {
            callback({
              status: "error",
              msg: i18n.t("downloadClient.serverConnectionFailed") //"服务器连接失败"
            })
          }
        }).catch((result) => {
          callback(result)
        })
        return;
      }

      let postData = {
        _sid: this.sessionId,
        api: 'SYNO.DownloadStation2.Task',
        method: 'create',
        version: 2,
        create_list: false
      }

      if (options.savePath) {
        let savePath = options.savePath + "";
        // 去除路径最后的 / ，以确保可以正常添加目录信息
        if (savePath.substr(-1) == "/") {
          savePath = savePath.substr(0, savePath.length - 1);
        }
        postData.destination = `"${savePath || ''}"`;
      }

      if (options.url.startWith('magnet:')) {
        postData.type = '"url"';
        postData.url = [options.url];

        this.addTorrent(postData, options, callback);
      } else {
        postData.type = '"file"';
        postData.file = ['torrent'];

        let formData = new FormData();
        Object.keys(postData).forEach((k) => {
          let v = postData[k];
          if (v !== undefined) {
            if (Array.isArray(v)) {
              v = JSON.stringify(v);
            }
            formData.append(k,v);
          }
        });


        PTBackgroundService.requestMessage({
          action: "getTorrentDataFromURL",
          data: options.url
        })
          .then((result) => {
            formData.append("file", result, "file.torrent")

            this.addTorrent(formData, options, callback);
          })
          .catch((result) => {
            callback && callback(result);
          });

      }
    }

    addTorrent(formData, options, callback) {
      $.ajax({
        url: `${this.options.address}/webapi/entry.cgi`,
        timeout: PTBackgroundService.options.connectClientTimeout,
        type: "POST",
        processData: false,
        contentType: false,
        data: formData,
        dataType: "json"
      }).done((result) => {
        console.log(result)
        if (result.error) {
          let errorMap = {
            400: i18n.t("downloadClient.fileUploadFailed"), // "文件上传失败",
            401: i18n.t("downloadClient.maxNumberOfTasksReached"), //"达到的最大任务数",
            402: i18n.t("downloadClient.destinationDenied", {
              path: options.savePath
            }), //`指定的目录[${options.savePath}]不可用或无权限`,
            403: i18n.t("downloadClient.destinationDoesNotExist", {
              path: options.savePath
            }) //`指定的目录[${options.savePath}]不存在`
          };
          /**
           * 400 File upload failed
              401 Max number of tasks reached
              402 Destination denied
              403 Destination does not exist
              404 Invalid task id
              405 Invalid task action
              406 No default destination
              407 Set destination failed
              408 File does not exist
           */
          if (result.error.code) {
            result.msg = errorMap[result.error.code];
          }
        }

        callback(result)
      }).fail(() => {
        callback({
          status: "error",
          msg: i18n.t("downloadClient.serverConnectionFailed") //"服务器连接失败"
        })
      })
    }
  }
  // 添加到 window 对象，用于客户页面调用
  window.synologyDownloadStation = Client;
})(jQuery, window)
