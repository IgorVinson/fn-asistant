fetch("https://app.fieldnation.com/v2/workorders/16391887/requests?acting_user_id=0&clientPayTermsAccepted=false", {
    headers: {
        "accept": "application/json",
        "accept-language": "en-US,en;q=0.9,uk-UA;q=0.8,uk;q=0.7,ru-UA;q=0.6,ru;q=0.5",
        "content-type": "application/json",
        "priority": "u=1, i",
        "sec-ch-ua": "\"Google Chrome\";v=\"131\", \"Chromium\";v=\"131\", \"Not_A Brand\";v=\"24\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"macOS\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "cookie": "vid=6f545478-2748-4155-afb2-05ab7090992d; hubspotutk=b1cdb5f459029a7dde4a82ca07b12126; drift_aid=f02d42d3-8a6c-4944-a71a-aa3a858984fb; driftt_aid=f02d42d3-8a6c-4944-a71a-aa3a858984fb; _hjSessionUser_3860837=eyJpZCI6IjllNjQyNzAxLWI5ODItNWViZS05MzEyLWIzMDA2NmJjYzhkOSIsImNyZWF0ZWQiOjE3MjY4MDAwMDcyODgsImV4aXN0aW5nIjp0cnVlfQ==; intercom-device-id-q77i1otv=b8cc2ee5-f2ae-4272-bf6d-b7d9c0d49b99; interval=86400; _fbp=fb.1.1727303126699.487340903197099809; rememberme=0; _ga_ZG9N0LNCYN=GS1.2.1732143192.2.0.1732143192.0.0.0; surveyed=true; amp_c12f4f=7wY8gurvMK6gJio0arQ1R0...1ie4vb9if.1ie4vb9ig.h.0.h; _uetvid=c71a9770b96c11ef8d64fde4ae073fea; _gid=GA1.2.1177364524.1735770033; ambassador_session.authentication-prod-oauth-filter.default=03a3cb679f0ea16af9d1cbaf43c076949fd7da86e919eecebd37bc32df9d8ec9; ambassador_xsrf.authentication-prod-oauth-filter.default=4fa4eef8bdf091c49f4a77ac8ee65e717843337ba75628e0674bb4561846e58a; __cfruid=db4660b2f70210fc4157324808c6d597581de137-1735770033; __hssrc=1; fnsid=s%3AeBoB3Svir6GrZpmJ0COrNdeLFdDQPSBs.Wu%2F875XtAeKLnMqKTFaYfVKcK%2F6%2FKKBTQUYX27ustWQ; _clck=15dfg4p%7C2%7Cfs7%7C0%7C1738; fn-user-id=s%3A983643.s3V4jyUhDmZX9xVCast4R5OgWrPtfX9Sj7wG19mi32c; fn-user-type=Provider; needs_to_accept_tos=false; FNSESS=MTo5ODM2NDM6MTo6MzM5ZDBhZjItNzcwZC00NmY3LTg3ZjAtN2ZmMTcxY2M3OTRkOjA6MDUxYTI2MDdkNjI0NmE5ZGIzZGIzOTliMWVkYzFiYWQ%3D; last_seen=1735770040005; __hstc=263070099.b1cdb5f459029a7dde4a82ca07b12126.1733803992231.1735770033151.1735772747083.4; __gtm_campaign_url=https%3A%2F%2Fdiscover.fieldnation.com%2F2024-year-in-review%3Flb-mode%3Doverlay%26%26lb-width%3D100%2525%26lb-height%3D100%2525; __gtm_referrer=https%3A%2F%2Ffieldnation.com%2F; _rdt_uuid=1733424187745.dfdc0837-2a44-488c-b880-266ac61c72fa; _clsk=1g2ynka%7C1735772838998%7C5%7C1%7Cj.clarity.ms%2Fcollect; _gcl_au=1.1.965728066.1735770033.404371572.1735772986.1735772986; _ga_XHDRZ3M33R=GS1.1.1735770033.16.1.1735773078.60.0.0; _pf_id.26e4=6f545478-2748-4155-afb2-05ab7090992d.1733424189.14.1735773079.1735770037.3822fa2b-52e6-44f3-840e-5a5aa090d5fe.f88f558b-c50b-4ba0-bf38-f0916b16cf93.b56d6431-50b9-498c-96d9-35a0e4341def.1735772745272.69; _ga=GA1.2.21599326.1733424187; remindMeLater_983643=true; intercom-session-q77i1otv=V29jZU9OL0gzdFVsNjZUdkh0dGJGM2RveE01SFNhazIzc3VFelpOc3M5WlJLdU1FbVRuRkxwUzZvUUpIVVFTRS0tOTJJS245eS9HZ2I1eVU1eFQ2UXFZUT09--2088b707044b30c2053434708c88ec658eabdec3",
        "Referer": "https://app.fieldnation.com/workorders/16391887?work_order_rank=1&work_order_total=34&work_order_list=workorders_available",
        "Referrer-Policy": "strict-origin-when-cross-origin"
    },
    // body: JSON.stringify({
    //     acting_user_id: 0,
    //     notes: "",
    //     withdrawDuration: false,
    //     expanded: true,
    //     eta: {
    //         user: { id: 0 },
    //         task: { id: 129534448 },
    //         start: { local: { date: "2025-01-28", time: "08:00:00" } },
    //         end: { local: { date: "", time: "" }, utc: "" },
    //         hour_estimate: 3,
    //         notes: "",
    //         status: { name: "unconfirmed", updated: { utc: "", local: { date: "", time: "" } } },
    //         mode: "exact",
    //         actions: [],
    //         validation: []
    //     },
    //     bundle: [],
    //     providerOptions: [],
    //     user: { id: 0 },
    //     schedule: {
    //         work_order_id: 16391887,
    //         service_window: {
    //             mode: "exact",
    //             start: { local: { date: "2025-01-28", time: "08:00:00" }, utc: "2025-01-28 13:00:00" },
    //             end: { local: { date: "", time: "" }, utc: "" }
    //         },
    //         time_zone: { id: 5, name: "America/New_York", offset: 1, short: "EST" },
    //         status_id: 2,
    //         company_id: 3117,
    //         today_tomorrow: "Tomorrow",
    //         est_labor_hours: 3,
    //         updated: {
    //             utc: "2024-12-20 15:50:48",
    //             local: { date: "2024-12-20", time: "10:50:48" },
    //             by: { id: 962123, name: "Integration User" }
    //         },
    //         requests: {
    //             metadata: { total: 0, per_page: 0, page: 1, pages: 1 },
    //             results: [],
    //             actions: []
    //         },
    //         correlation_id: "397daa1219ea5c1fa893ca4c3e0aec8aa4cb2fa9",
    //         actions: []
    //     },
    //     title: "Low Voltage: Test and Diagnose Store Cabling, hook up existing paging and Fax. Cross connect new devices. Install Preconfigured IP Phones.",
    //     hasConflict: false,
    //     hasEta: true
    // }),
    method: "POST",
})


//             fetch("https://app.fieldnation.com/v2/workorders/16391887/requests?acting_user_id=0&clientPayTermsAccepted=false", {
//     "headers": {
//         "accept": "application/json",
//         "accept-language": "en-US,en;q=0.9,uk-UA;q=0.8,uk;q=0.7,ru-UA;q=0.6,ru;q=0.5",
//         "content-type": "application/json",
//         "priority": "u=1, i",
//         "sec-ch-ua": "\"Google Chrome\";v=\"131\", \"Chromium\";v=\"131\", \"Not_A Brand\";v=\"24\"",
//         "sec-ch-ua-mobile": "?0",
//         "sec-ch-ua-platform": "\"macOS\"",
//         "sec-fetch-dest": "empty",
//         "sec-fetch-mode": "cors",
//         "sec-fetch-site": "same-origin",
//         "cookie": "vid=6f545478-2748-4155-afb2-05ab7090992d; hubspotutk=b1cdb5f459029a7dde4a82ca07b12126; drift_aid=f02d42d3-8a6c-4944-a71a-aa3a858984fb; driftt_aid=f02d42d3-8a6c-4944-a71a-aa3a858984fb; _hjSessionUser_3860837=eyJpZCI6IjllNjQyNzAxLWI5ODItNWViZS05MzEyLWIzMDA2NmJjYzhkOSIsImNyZWF0ZWQiOjE3MjY4MDAwMDcyODgsImV4aXN0aW5nIjp0cnVlfQ==; intercom-device-id-q77i1otv=b8cc2ee5-f2ae-4272-bf6d-b7d9c0d49b99; interval=86400; _fbp=fb.1.1727303126699.487340903197099809; rememberme=0; _ga_ZG9N0LNCYN=GS1.2.1732143192.2.0.1732143192.0.0.0; surveyed=true; amp_c12f4f=7wY8gurvMK6gJio0arQ1R0...1ie4vb9if.1ie4vb9ig.h.0.h; _uetvid=c71a9770b96c11ef8d64fde4ae073fea; _gid=GA1.2.1177364524.1735770033; ambassador_session.authentication-prod-oauth-filter.default=03a3cb679f0ea16af9d1cbaf43c076949fd7da86e919eecebd37bc32df9d8ec9; ambassador_xsrf.authentication-prod-oauth-filter.default=4fa4eef8bdf091c49f4a77ac8ee65e717843337ba75628e0674bb4561846e58a; __cfruid=db4660b2f70210fc4157324808c6d597581de137-1735770033; __hssrc=1; fnsid=s%3AeBoB3Svir6GrZpmJ0COrNdeLFdDQPSBs.Wu%2F875XtAeKLnMqKTFaYfVKcK%2F6%2FKKBTQUYX27ustWQ; _clck=15dfg4p%7C2%7Cfs7%7C0%7C1738; fn-user-id=s%3A983643.s3V4jyUhDmZX9xVCast4R5OgWrPtfX9Sj7wG19mi32c; fn-user-type=Provider; needs_to_accept_tos=false; FNSESS=MTo5ODM2NDM6MTo6MzM5ZDBhZjItNzcwZC00NmY3LTg3ZjAtN2ZmMTcxY2M3OTRkOjA6MDUxYTI2MDdkNjI0NmE5ZGIzZGIzOTliMWVkYzFiYWQ%3D; last_seen=1735770040005; __hstc=263070099.b1cdb5f459029a7dde4a82ca07b12126.1733803992231.1735770033151.1735772747083.4; __gtm_campaign_url=https%3A%2F%2Fdiscover.fieldnation.com%2F2024-year-in-review%3Flb-mode%3Doverlay%26%26lb-width%3D100%2525%26lb-height%3D100%2525; __gtm_referrer=https%3A%2F%2Ffieldnation.com%2F; _rdt_uuid=1733424187745.dfdc0837-2a44-488c-b880-266ac61c72fa; _clsk=1g2ynka%7C1735772838998%7C5%7C1%7Cj.clarity.ms%2Fcollect; _gcl_au=1.1.965728066.1735770033.404371572.1735772986.1735772986; _ga_XHDRZ3M33R=GS1.1.1735770033.16.1.1735773078.60.0.0; _pf_id.26e4=6f545478-2748-4155-afb2-05ab7090992d.1733424189.14.1735773079.1735770037.3822fa2b-52e6-44f3-840e-5a5aa090d5fe.f88f558b-c50b-4ba0-bf38-f0916b16cf93.b56d6431-50b9-498c-96d9-35a0e4341def.1735772745272.69; _ga=GA1.2.21599326.1733424187; remindMeLater_983643=true; intercom-session-q77i1otv=V29jZU9OL0gzdFVsNjZUdkh0dGJGM2RveE01SFNhazIzc3VFelpOc3M5WlJLdU1FbVRuRkxwUzZvUUpIVVFTRS0tOTJJS245eS9HZ2I1eVU1eFQ2UXFZUT09--2088b707044b30c2053434708c88ec658eabdec3",
//         "Referer": "https://app.fieldnation.com/workorders/16391887?work_order_rank=1&work_order_total=34&work_order_list=workorders_available",
//         "Referrer-Policy": "strict-origin-when-cross-origin"
//     },
//     "body": "{\"acting_user_id\":0,\"notes\":\"\",\"withdrawDuration\":false,\"expanded\":true,\"eta\":{\"user\":{\"id\":0},\"task\":{\"id\":129534448},\"start\":{\"local\":{\"date\":\"2025-01-28\",\"time\":\"08:00:00\"}},\"end\":{\"local\":{\"date\":\"\",\"time\":\"\"},\"utc\":\"\"},\"hour_estimate\":3,\"notes\":\"\",\"status\":{\"name\":\"unconfirmed\",\"updated\":{\"utc\":\"\",\"local\":{\"date\":\"\",\"time\":\"\"}}},\"mode\":\"exact\",\"actions\":[],\"validation\":[]},\"bundle\":[],\"providerOptions\":[],\"user\":{\"id\":0},\"schedule\":{\"work_order_id\":16391887,\"service_window\":{\"mode\":\"exact\",\"start\":{\"local\":{\"date\":\"2025-01-28\",\"time\":\"08:00:00\"},\"utc\":\"2025-01-28 13:00:00\"},\"end\":{\"local\":{\"date\":\"\",\"time\":\"\"},\"utc\":\"\"}},\"time_zone\":{\"id\":5,\"name\":\"America/New_York\",\"offset\":1,\"short\":\"EST\"},\"status_id\":2,\"company_id\":3117,\"today_tomorrow\":\"Tomorrow\",\"est_labor_hours\":3,\"updated\":{\"utc\":\"2024-12-20 15:50:48\",\"local\":{\"date\":\"2024-12-20\",\"time\":\"10:50:48\"},\"by\":{\"id\":962123,\"name\":\"Integration User\"}},\"requests\":{\"metadata\":{\"total\":0,\"per_page\":0,\"page\":1,\"pages\":1},\"results\":[],\"actions\":[]},\"correlation_id\":\"397daa1219ea5c1fa893ca4c3e0aec8aa4cb2fa9\",\"actions\":[]},\"title\":\"Low Voltage: Test and Diagnose Store Cabling, hook up existing paging and Fax. Cross connect new devices. Install Preconfigured IP Phones.\",\"hasConflict\":false,\"hasEta\":true}",
//     "method": "POST"
// });