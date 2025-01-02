fetch("https://app.fieldnation.com/workorders/16428939?work_order_rank=29&work_order_total=34&work_order_list=workorders_available", {
    "headers": {
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "accept-language": "en-US,en;q=0.9,uk-UA;q=0.8,uk;q=0.7,ru-UA;q=0.6,ru;q=0.5",
        "cache-control": "max-age=0",
        "priority": "u=0, i",
        "sec-ch-ua": "\"Google Chrome\";v=\"131\", \"Chromium\";v=\"131\", \"Not_A Brand\";v=\"24\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"macOS\"",
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "same-origin",
        "sec-fetch-user": "?1",
        "upgrade-insecure-requests": "1",
        "cookie": "\n" +
            "__cfruid=d4e5e83136ecba10c080c1eddcb5c4f25ae427ac-1735769438; ambassador_session.authentication-prod-oauth-filter.default=6aaf24d3aebdc0ff28db75467646116007d5cf0156682405782d71bafa72ce02; ambassador_xsrf.authentication-prod-oauth-filter.default=2388a3b3f9f76e7a42a928eefe3388c3caf217adea5deba083c2e20b9dbd0c38; fnsid=s%3AAnwRu0QrkyghZvWkFcMxJVXyVLwD0QFn.fQAp5da5mNW%2FkUUtFil6bJYGHzta%2BfUN%2FjNzVMWmGEg; remindMeLater_983643=true; needs_to_accept_tos=false; FNSESS=MTo5ODM2NDM6MTo6YzY2ZTc5YmQtYzhiMi00NTkyLWJhYjEtYWEzZDhmNTU5Y2FmOjA6NGQxMDkxYWNiM2RmYTZmOWZhZWQ0NDk1NzY0NTRkMzY%3D; last_seen=1735769459554; _ga=GA1.2.2099391680.1735769460; _gid=GA1.2.1195137892.1735769460; _gat=1; intercom-device-id-q77i1otv=f69fa80e-cd6a-4047-8add-d07fb26f6cbc; intercom-session-q77i1otv=TmFQL2tNM2J5dWJ2cnQvUU5kSmpMbVJRRFN6YWUvVVhkQmJYRWRDUzQ3cHVPNk1YYUVEUHVtMzJwZk9HeEp3eS0tTi9XMlEyenBsL0NpbFBQLytVSHdvQT09--503bae1469d7e0139cb0ad49e04a95113942c1b7",
        "Referer": "https://app.fieldnation.com/workorders/",
        "Referrer-Policy": "strict-origin-when-cross-origin"
    },
    "body": null,
    "method": "GET"
}).then(
    async response => {
        const start =  "<script type=\"text/javascript\">window.work_order =";
        const end = ";</script>";
        const workOrderRegEx = new RegExp(start + "(.+?)" + end, "m");
        const text = await response.text();
        const workOrder = workOrderRegEx.exec(text)[1];
        const workOrderObj = JSON.parse(workOrder.trim());
        const analysingData = {
            title: workOrderObj.title,
            startDateAndTime: workOrderObj.schedule.service_window.start,
            distance: workOrderObj.coords.distance,
            payRange: workOrderObj.pay.range,
            estLaborHours: workOrderObj.schedule.est_labor_hours
        }
        console.dir(analysingData)

    }
)



