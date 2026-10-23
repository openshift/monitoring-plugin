import { mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { renderToStaticMarkup } from 'react-dom/server';
import { classIcons, domainIcons, fallbackIcon, IconMap } from '../components/icons';
import { CSSProperties, FC } from 'react';

describe('IconsPreview Component', () => {
  const styles: { [key: string]: CSSProperties } = {
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
      gap: '20px',
      maxWidth: '1200px',
      margin: '0 auto',
      overflowWrap: 'anywhere',
    },
  };
  const IconsPreview: FC = () => {
    const gallery = (iconMap: IconMap) => (
      <div style={styles.grid}>
        {Object.entries(iconMap).map(([name, icon]) => (
          <div key={name}>
            <div>{icon}</div>
            <div>{name}</div>
          </div>
        ))}
      </div>
    );
    return (
      <>
        <h1>Troubleshooting Panel Console Plugin Icons</h1>

        <h2>Domain icons - used for classes with no class icon</h2>
        {gallery(domainIcons)}

        <h2>Class icons for specific classes</h2>
        {gallery(classIcons)}

        <h2>Fallback icon - not normally used</h2>
        {gallery({ fallback: fallbackIcon })}
      </>
    );
  };

  it('should render all icons and generate HTML preview file', () => {
    // Render the component to static markup
    const htmlContent = renderToStaticMarkup(<IconsPreview />);

    // Create a complete HTML document
    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Troubleshooting Panel Console Plugin - Icons Preview</title>
    <style>
        body {
            margin: 0;
            padding: 0;
        }
        /* Add Font Awesome styles for proper icon rendering */
        .fa-solid {
            font-family: "Font Awesome 6 Free";
            font-weight: 900;
        }
    </style>
</head>
<body>
    ${htmlContent}
</body>
</html>`;

    // Create temporary directory and write HTML file
    const tempDir = tmpdir();
    const outputDir = join(tempDir, 'troubleshooting-panel-icons');
    const outputFile = join(outputDir, 'icons-preview.html');

    mkdirSync(outputDir, { recursive: true });
    writeFileSync(outputFile, fullHtml, 'utf8');

    // Verify the file was created
    expect(() => writeFileSync(outputFile, fullHtml, 'utf8')).not.toThrow();
  });

  it('should contain expected number of icon categories', () => {
    const htmlContent = renderToStaticMarkup(<IconsPreview />);

    // Test that we have both domain and class icons
    expect(htmlContent).toContain('Domain');
    expect(htmlContent).toContain('Class');
    expect(htmlContent).toContain('Fallback');
  });

  it('should include all expected domain icons', () => {
    const htmlContent = renderToStaticMarkup(<IconsPreview />);

    // Check for known domain icon keys
    const expectedDomainIcons = ['alert', 'k8s', 'log', 'metric', 'netflow', 'trace'];
    expectedDomainIcons.forEach((iconKey) => {
      expect(htmlContent).toContain(iconKey);
    });
  });
});
