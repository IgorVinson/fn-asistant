fetch("https://www.workmarket.com/assignments/details/5659140276", {
    "headers": {
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "max-age=0",
        "priority": "u=0, i",
        "sec-ch-ua": "\"Chromium\";v=\"131\", \"Not_A Brand\";v=\"24\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"macOS\"",
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "same-origin",
        "sec-fetch-user": "?1",
        "upgrade-insecure-requests": "1",
        "cookie": "rxVisitor=1736656517445HKP8R1L840K1HCA6TKO3EEE3O0T0P4O2; ak_bmsc=05C5AC970DA0A099E8B959958B8B8C59~000000000000000000000000000000~YAAQHMHOF2Rse02UAQAAXITLWBq1XELvp4HStySOH+xnUZpwOdkE2SZhCS/HqEhKzbL64aCBXUG+f7MyCZgS6IeXheUR5VNKC3vcdgWuRxzCCc/YeMjujjeP5xIy+M93oUn5zQ125W++fAEO7QJYV7ed8a7+pU4o3Sl5xog6VvmCPrZu/nGdWN60MDqyFP/v88LQlKV5ibqaxcmZHay2AFL8gtH5NRtSWd3j5sAClGvhKPGUhUz5HDtKMn80jSkbjRtHn0YoOL8b6GIPoeKZkAo05xleajkDewog7m47Mfk9Y01+HD4AHjKKv25ls0tYu0fxZT1S/YYaAamSQk4HAROU7m3gIhPDJhmxYVhUa2t/xa0zapM8c5oe4/meG7fKjpEw5ov7KgNa8K4F7a0TDXD6N0P6w6DzXm2W/6jQktyAXq44lUgIn8M90loO/K81TVvsNWl4Js6b/KSJ5UvJDtq+5fjpzsBynhVayK0eCDuZZgSwt5+Qu/uYzX22CUAUhn4oeEiP5bCL1RZB1dnDgYQYNxEQjElSjuMjhaE1; dtCookie=v_4_srv_39_sn_D51C36050FAE7E78F88C07DC0316269F_app-3Ab1d929a11e01274d_1_ol_0_perc_100000_mul_1; JSESSIONID=2C8A9CD6ED6CF92EFD0BF88D1105C861-n1; CSRFToken=ld8mkX7bEvu5W-TRve2gWq8HVXtXO-DmjS2yDNOTV1w; wm.waypoint.theme=false; workmarketSessionId=h01ANwgEAzs1h7PD-2025-01-12-04-37-24; removeMonolithAppBar=false; removeAppBar=false; hideFooter=false; spaCallback=; totango.heartbeat.last_module=__system; __zlcmid=1PgnJTqa88HkoSL; k8Ksj346=BWJ6y1iUAQAA2anlS_hL3ao40B0FkSBqc2492L2DvirT3zviKi8Nh5_SzplnJK5y78vAf14I5--iwl4IJgAQBKAxoNX1NoPiHhlrzw|1|0|58e46b6e6893e2b5519eed7fcaaadf7f43d422e6; ajs_anonymous_id=2dcf6870-f50f-4136-a145-50e0bc1237fa; dtSa=-; ajs_user_id=87910010-3de7-4b1c-9b94-dd083ce42faa; ajs_group_id=b96eeaa7-4df7-42b8-8aa8-fb4d08642543; totango.heartbeat.last_ts=1736657090276; rxvt=1736658890768|1736656517448; dtPC=39$257088424_935h-vLTVKHEGUGNIFVUFRCLFFHBHRAERPDOFG-0e0",
        "Referer": "https://www.workmarket.com/login?redirectTo=/assignments/details/5659140276",
        "Referrer-Policy": "strict-origin-when-cross-origin"
    },
    "body": null,
    "method": "GET"
}).then(
    async response => {
        const body = await response.text(); // Use response.json() if expecting JSON
        console.log(body);

    }
)