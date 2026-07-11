from bs4 import BeautifulSoup
import os

path = "unicast_final_report.html"
out_path = "tables_for_critic.md"

with open(out_path, "w", encoding="utf-8") as out:
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            html = f.read()
        
        soup = BeautifulSoup(html, "html.parser")
        tables = soup.find_all("table", class_="scientific-table")
        headers = soup.find_all("h3")
        
        out.write("# UniCast Final Report - Statistical Analysis Tables\n\n")
        out.write("These tables show the final statistical comparisons computed with the hybrid model:\n")
        out.write("- **Audio Effect:** Paired T-Test (`scipy.stats.ttest_rel`)\n")
        out.write("- **Resolution and Content Effects:** Welch's Independent T-Test (`scipy.stats.ttest_ind` with `equal_var=False`)\n")
        out.write("- **Outliers:** network outage window (00:23:00 to 01:26:30) excluded using robust datetime comparison.\n\n")
        
        for i, table in enumerate(tables):
            title = headers[i].text if i < len(headers) else f"Table {i+1}"
            out.write("## " + title + "\n\n")
            
            rows = table.find_all("tr")
            # Headers
            th_cols = [th.text.strip() for th in rows[0].find_all("th")]
            out.write("| " + " | ".join(th_cols) + " |\n")
            out.write("| " + " | ".join(["---"] * len(th_cols)) + " |\n")
            
            for row in rows[1:]:
                td_cols = []
                # Check for rowspan to handle subscenario column
                tds = row.find_all(["td", "th"])
                for td in tds:
                    td_cols.append(td.text.strip())
                if not td_cols:
                    continue
                out.write("| " + " | ".join(td_cols) + " |\n")
            out.write("\n")
    else:
        out.write("Report file does not exist!\n")
print("Done writing tables_for_critic.md")
