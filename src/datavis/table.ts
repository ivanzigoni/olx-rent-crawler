import * as fs from "fs/promises";
import path from "node:path";

interface Property {
  link: string;
  title: string;
  rooms: number;
  area: number;
  bathrooms: number;
  price: number;
  iptu: number;
  condominio: number;
  location: string;
  datePosted: string;
  origin: string;
}

export async function generatePropertiesHtml(
  jsonFilePath: string,
  outputHtmlPath: string,
  rowsPerPage = 10
) {
  // Load JSON array
  const jsonData = await fs.readFile(jsonFilePath, "utf-8");
  const properties: Property[] = JSON.parse(jsonData);

  const uniqueOrigin = properties.reduce(
    (acc, p) => {
      if (!acc.accumulator[p.origin]) {
        acc.accumulator[p.origin] = true;
        acc.result.push(p.origin);
      }

      return acc;
    },
    {
      accumulator: {},
      result: [],
    } as { accumulator: { [key: string]: boolean }; result: string[] }
  );

  // Columns data for table and sorting info
  const columns = [
    { key: "link", label: "LINK", sortable: false },
    { key: "title", label: "TITULO", sortable: false },
    { key: "price", label: "ALUGUEL", sortable: true },
    { key: "iptu", label: "IPTU", sortable: true },
    { key: "condominio", label: "CONDOMINIO", sortable: true },
    { key: "totalPrice", label: "TOTAL", sortable: true },
    { key: "area", label: "AREA", sortable: true },
    { key: "bedrooms", label: "QUARTO", sortable: true },
    { key: "bathrooms", label: "BANHEIRO", sortable: true },
    { key: "location", label: "LOCALIZACAO", sortable: false },
    { key: "datePosted", label: "DATA ANUNCIO", sortable: false },
  ];

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>AGREGADOR ALUGUEL</title>
<style>
      body {
        font-family: Arial, sans-serif;
        padding: 20px;
      }
      table {
        border-collapse: collapse;
        width: 100%;
        height: 80vh;
      }
      tr {
        height: 50px;
      }
      th,
      td {
        border: 1px solid #ddd;
        padding: 8px;
      }
      th {
        cursor: pointer;
        background-color: #f2f2f2;
        user-select: none;
      }
      th.sortable:hover {
        background-color: #ddd;
      }
      th.asc::after {
        content: " ▲";
      }
      th.desc::after {
        content: " ▼";
      }
      a {
        color: blue;
        text-decoration: underline;
      }
      .pagination {
        margin-top: 10px;
      }
      .pagination button {
        padding: 6px 12px;
        margin-right: 4px;
      }
      .row-dark {
        background-color: #f2f2f2;
      }
</style>
</head>
<body>
<h4>ORIGENS: ${uniqueOrigin.result.join(", ")}</h4>
<table id="propertiesTable">
  <thead>
    <tr>
      ${columns
        .map((col) =>
          col.sortable
            ? `<th class="sortable" data-key="${col.key}">${col.label}</th>`
            : `<th>${col.label}</th>`
        )
        .join("")}
    </tr>
  </thead>
  <tbody id="tableBody">
    <!-- Rows rendered by JS -->
  </tbody>
</table>

<div class="pagination" id="paginationControls"></div>

<script>
  // Data from TypeScript variable injection:
  const data = ${JSON.stringify(properties)};
  const rowsPerPage = ${rowsPerPage};

  let currentPage = 1;
  let sortKey = null;
  let sortOrderAsc = true;

  // Render table rows for the current page and sort order
  function renderTable() {
    let sortedData = [...data];
    if (sortKey) {
      sortedData.sort((a, b) => {
        const valA = a[sortKey];
        const valB = b[sortKey];
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortOrderAsc ? valA - valB : valB - valA;
        }
        // fallback no sorting for non-number (should not be here since only numeric sortable)
        return 0;
      });
    }

    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const pageData = sortedData.slice(start, end);

    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = pageData
      .map((item, i) => \`
        <tr class=\${i%2===0?"":"row-dark"}>
          <td><a href="\${item.link}" target="_blank" rel="noopener noreferrer">\${item.origin.substring(0,3)}</a></td>
          <td>\${item.title}</td>
          <td>\${item.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
          <td>\${item.iptu.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
          <td>\${item.condominio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
          <td>\${item.totalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
          <td>\${item.area}</td>
          <td>\${item.bedrooms}</td>
          <td>\${item.bathrooms}</td>
          <td>\${item.location}</td>
          <td>\${item.datePosted}</td>
        </tr>\`).join('');
    
    renderPagination(sortedData.length);
    updateSortIndicators();
  }

  // Render pagination buttons
  function renderPagination(totalItems) {
    const totalPages = Math.ceil(totalItems / rowsPerPage);
    const container = document.getElementById('paginationControls');
    container.innerHTML = '';

    if (totalPages <= 1) return;

    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.textContent = 'Prev';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => { if(currentPage > 1) { currentPage--; renderTable(); } };
    container.appendChild(prevBtn);

    // Numbered buttons (limit to 7 pages for big dataset)
    let startPage = Math.max(1, currentPage - 3);
    let endPage = Math.min(totalPages, currentPage + 3);

    for (let i = startPage; i <= endPage; i++) {
      const btn = document.createElement('button');
      btn.textContent = i.toString();
      if (i === currentPage) btn.disabled = true;
      btn.onclick = () => { currentPage = i; renderTable(); };
      container.appendChild(btn);
    }

    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Next';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => { if(currentPage < totalPages) { currentPage++; renderTable(); } };
    container.appendChild(nextBtn);
  }

  // Update arrow indicators on headers
  function updateSortIndicators() {
    const headers = document.querySelectorAll('th.sortable');
    headers.forEach((th) => {
      th.classList.remove('asc', 'desc');
      if (th.dataset.key === sortKey) {
        th.classList.add(sortOrderAsc ? 'asc' : 'desc');
      }
    });
  }

  // Sort on header click
  document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const clickedKey = th.dataset.key;
      if (sortKey === clickedKey) {
        sortOrderAsc = !sortOrderAsc;
      } else {
        sortKey = clickedKey;
        sortOrderAsc = true;
      }
      currentPage = 1;
      renderTable();
    });
  });

  // Initial render
  renderTable();

</script>

</body>
</html>`;

  await fs.writeFile(outputHtmlPath, html, "utf-8");
  console.log(`HTML file saved to: ${outputHtmlPath}`);
}
